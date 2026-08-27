"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Clock, SearchX, UtensilsCrossed } from "lucide-react";

import {
  MENU_PAGE_SIZE,
  MIN_ITEMS_FOR_RECOMMENDATIONS,
  filterMenu,
  flattenMenu,
  headingBefore,
  pageCount,
  pageOf,
} from "@/lib/restaurant/menu-order";
import { CartBar, CartSheet } from "@/components/order/cart-sheet";
import { CategoryCarousel } from "@/components/order/category-carousel";
import { CheckoutSheet } from "@/components/order/checkout-sheet";
import { CustomerAuthDialog } from "@/components/order/customer-auth-dialog";
import { OrderHistoryDialog } from "@/components/order/order-history-dialog";
import { ItemOptionsSheet } from "@/components/order/item-options-sheet";
import { MenuItemCard } from "@/components/order/menu-item-card";
import { MenuPager } from "@/components/order/menu-pager";
import { MenuToolbar } from "@/components/order/menu-toolbar";
import { PlatformCredit } from "@/components/order/platform-credit";
import { RecommendedStrip } from "@/components/order/recommended-strip";
import { RestaurantHero } from "@/components/order/restaurant-hero";
import { ResumeOrderBanner } from "@/components/order/resume-order-banner";
import { ReviewsSection } from "@/components/order/reviews-section";
import { TrackOrderDialog } from "@/components/order/track-order-dialog";
import { RewardPopup } from "@/components/order/reward-popup";
import { MyRewardsSheet } from "@/components/order/my-rewards-sheet";
import { isCustomisable, useCart } from "@/components/order/use-cart";
import type {
  PublicMenuCategory,
  PublicMenuItem,
  PublicRestaurant,
  PublicTable,
} from "@/components/order/types";

/**
 * Tiles per shortcut strip.
 *
 * Both strips can now show at once, so each is capped: six tiles is a little
 * over two screens of horizontal swipe on a phone and keeps the pair from
 * pushing the menu itself below the fold, which is the whole reason only one
 * strip used to render.
 */
const STRIP_LIMIT = 6;

/**
 * The customer menu.
 *
 * This component owns state only — cart, search, filter, page, which panel is
 * open — and delegates every pixel to the components below it. It used to
 * render its own hero, toolbar and dish row inline while parallel versions of
 * all three sat unused next to it; keeping rendering out of here is what stops
 * that happening again. The ordering, filtering and paging maths lives in
 * lib/restaurant/menu-order.ts for the same reason.
 *
 * Filtering and paging are both client-side: the menu arrives whole, so a
 * round trip per keystroke or per page turn would be slower and would fail on
 * exactly the patchy connections this page is usually opened over.
 */
export function MenuBrowser({
  restaurant,
  table,
  categories,
  recommendedItemIds,
}: {
  restaurant: PublicRestaurant;
  table: PublicTable | null;
  categories: PublicMenuCategory[];
  /** Dish ids to feature, most-ordered first. Empty means show no strip. */
  recommendedItemIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<"none" | "cart" | "checkout">("none");
  // The dish being configured. Confirming the sheet always adds to the cart
  // and returns to the menu — nothing here jumps to checkout, so there is no
  // "and then where" to carry alongside the item.
  const [optionsFor, setOptionsFor] = useState<PublicMenuItem | null>(null);
  // Independent of `panel`: this is a lookup dialog reachable from anywhere
  // on the page, not a step in the cart → checkout flow.
  const [showTrackOrder, setShowTrackOrder] = useState(false);
  // Same idea for the sign-in dialog: reachable from anywhere on the page,
  // not part of the cart → checkout flow.
  const [showAuth, setShowAuth] = useState(false);
  // The signed-in counterpart to showTrackOrder — no number to type, so it
  // reads the session instead of asking.
  const [showHistory, setShowHistory] = useState(false);
  const [showMyRewards, setShowMyRewards] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; mobile: string } | null>(null);
  // The signed-in guest's own most-ordered dishes. Personal, so it can't ride
  // down with the page — that payload is shared and cached. Fetched from the
  // session cookie once the guest is known.
  const [favouriteItemIds, setFavouriteItemIds] = useState<string[]>([]);
  // Tri-state, not just `customer`: "no session yet" and "session still
  // loading" have to be told apart, or the arrival prompt below flashes in
  // the face of a guest who is already signed in.
  const [sessionChecked, setSessionChecked] = useState(false);
  // Scroll target for a page change. Turning a page and landing halfway down
  // the new one is the single most disorienting thing a pager can do.
  const listRef = useRef<HTMLDivElement | null>(null);

  const cart = useCart(categories);

  // Whether a guest is already signed in with this restaurant only matters
  // once, on load — nothing else on the page changes it besides the dialog
  // and the sign-out button below, both of which update `customer` directly.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/order/customer-auth/me?restaurantSlug=${restaurant.slug}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.customer) setCustomer(data.customer);
      } catch {
        // Not signed in is the default state; nothing to recover from here.
      } finally {
        // Always, including on failure: a guest whose /me request died still
        // has to be able to reach the prompt rather than a blank screen.
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurant.slug]);

  /**
   * Re-run whenever the guest changes, not just on load: signing in mid-visit
   * is the moment their history becomes available, and signing out is the
   * moment it must stop being shown on a shared table QR.
   */
  useEffect(() => {
    if (!customer) {
      setFavouriteItemIds([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/order/customer-auth/favourites?restaurantSlug=${restaurant.slug}`
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && Array.isArray(data?.itemIds)) setFavouriteItemIds(data.itemIds);
      } catch {
        // A first-time guest has no history either, and that renders the same
        // way — so a failed fetch degrades into the trending strip rather
        // than into an error the guest can do nothing about.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customer, restaurant.slug]);

  async function handleSignOut() {
    try {
      await fetch("/api/order/customer-auth/logout", { method: "POST" });
    } catch {
      // The cookie is httpOnly and cleared server-side; a dropped request
      // just means the local "signed in" state below outlives it slightly.
    }
    setCustomer(null);
  }

  /**
   * A closed restaurant still shows its full menu — browsing is the point of a
   * QR code on a table at 3pm — but nothing can be added to a cart. Hiding the
   * menu instead would leave a guest unable to tell whether the place is shut
   * or the link is broken.
   */
  const { isOpen } = restaurant.openState;

  /**
   * The whole menu as one ordered stream, with rush-demoted dishes pushed to
   * the end. Recomputed only when the menu or the rush state changes — not on
   * every keystroke, which is what the separate filter step below is for.
   */
  const stream = useMemo(
    () => flattenMenu(categories, { isPeak: restaurant.peakState.isPeak }),
    [categories, restaurant.peakState.isPeak]
  );

  const matched = useMemo(
    () => filterMenu(stream, { query, vegOnly, categoryId: categoryFilter }),
    [stream, query, vegOnly, categoryFilter]
  );

  const totalPages = pageCount(matched.length);
  // Clamped rather than stored: filters shrink the result set as the guest
  // types, and a stored page 4 against a one-page result would render blank.
  const currentPage = Math.min(page, totalPages);
  const visible = pageOf(matched, currentPage);

  const isFiltering = query.trim().length > 0 || vegOnly || categoryFilter !== null;

  /**
   * Resolves a list of ids against the live menu.
   *
   * Kept in id order rather than menu order: the whole point of both strips is
   * that the most-ordered dish leads. The lookup is defensive because the ids
   * and the menu are produced on different clocks — trending is cached for
   * five minutes, favourites are fetched separately, and either can name a
   * dish the owner has since pulled.
   */
  const resolveStrip = useMemo(() => {
    const byId = new Map(stream.map((item) => [item.id, item]));

    return (ids: string[]) => {
      if (stream.length < MIN_ITEMS_FOR_RECOMMENDATIONS) return [];
      return ids
        .map((id) => byId.get(id))
        .filter((item): item is (typeof stream)[number] => Boolean(item))
        .filter((item) => item.isAvailable)
        // A demoted dish must not be promoted back to the top of the page by
        // the very demand the demotion exists to dampen.
        .filter((item) => !(restaurant.peakState.isPeak && item.demoteAtPeak));
    };
  }, [stream, restaurant.peakState.isPeak]);

  const favourites = useMemo(
    () => resolveStrip(favouriteItemIds),
    [resolveStrip, favouriteItemIds]
  );
  const trending = useMemo(
    () => resolveStrip(recommendedItemIds),
    [resolveStrip, recommendedItemIds]
  );

  /**
   * Two strips, each answering a different question.
   *
   * This used to pick one: favourites replaced recommendations outright, on the
   * grounds that two strips is roughly a phone screen of shortcuts before the
   * menu begins. The cost of that was invisible and worse — a returning guest
   * could never see what the restaurant is known for, because having any order
   * history permanently suppressed it. "What do I usually get" and "what is
   * good here" are different questions and a guest may well be asking the
   * second one.
   *
   * The screen-space objection is answered by capping each strip rather than by
   * deleting one of them, and recommendations lead: they are the answer for a
   * guest who has not decided yet, while a guest who wants their usual is
   * already looking for it.
   */
  const recommended = useMemo(() => {
    // A dish already offered under "Order it again" must not appear twice on
    // one screen — the same tile in two rows reads as a rendering bug, and the
    // second copy spends a slot that another dish could have used.
    const inFavourites = new Set(favourites.map((item) => item.id));
    return trending.filter((item) => !inFavourites.has(item.id)).slice(0, STRIP_LIMIT);
  }, [trending, favourites]);

  const favouritesStrip = useMemo(() => favourites.slice(0, STRIP_LIMIT), [favourites]);

  /** Any filter change puts the guest back on page 1 — page 4 of a new result
   * set is a different, arbitrary place. */
  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function goToPage(next: number) {
    setPage(next);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * A plain dish goes straight into the cart; anything with a size or an
   * add-on has to be asked about first. Tapping + on a card that is already in
   * the cart bumps the plain line, since that is the one the card's count came
   * from.
   *
   * This is the ONLY way a dish enters the cart, and it always leaves the
   * guest on the menu. There used to be a "Buy now" on the shortcut tiles that
   * added and jumped to checkout, which meant a table wanting a second dish
   * was pushed at the pay screen after the first. Adding and paying are
   * separate steps now: the cart bar is the only road to checkout.
   */
  function handleAdd(item: PublicMenuItem) {
    if (!isOpen) return;
    if (isCustomisable(item)) {
      setOptionsFor(item);
      return;
    }
    cart.add({ itemId: item.id, variantId: null, addOnIds: [] });
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "var(--resto-bg)" }}>
      <RestaurantHero restaurant={restaurant} table={table} />

      <ResumeOrderBanner slug={restaurant.slug} />

      <div className="mx-auto mt-3 flex w-full max-w-[var(--resto-measure)] items-center justify-between gap-3 px-4">
        {customer ? (
          <p className="text-xs" style={{ color: "var(--resto-text-muted)" }}>
            Hi, {customer.name} ·{" "}
            <button
              type="button"
              onClick={handleSignOut}
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: "var(--resto-text-muted)" }}
            >
              Sign out
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowAuth(true)}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--resto-text-muted)" }}
          >
            Sign in with mobile number
          </button>
        )}
        {/* Signed in, the mobile number is already known, so the history opens
            straight from the session — asking for the number again would be
            the one thing signing in was meant to save. */}
        <div className="flex items-center gap-4 shrink-0">
          {customer && (
            <button
              type="button"
              onClick={() => setShowMyRewards(true)}
              className="text-xs font-semibold underline-offset-2 hover:underline"
              style={{ color: "var(--resto-brand-text)" }}
            >
              Rewards
            </button>
          )}
          <button
            type="button"
            onClick={() => (customer ? setShowHistory(true) : setShowTrackOrder(true))}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--resto-text-muted)" }}
          >
            {customer ? "My orders" : "Track my order"}
          </button>
        </div>
      </div>

      {!isOpen && (
        <div className="mx-auto mt-6 w-full max-w-[var(--resto-measure)] px-4">
          <p
            className="flex items-center gap-2 border px-4 py-3 text-sm font-medium"
            role="status"
            style={{
              backgroundColor: "var(--resto-error-soft)",
              borderColor: "var(--resto-error)",
              borderRadius: "var(--resto-radius-md)",
              color: "var(--resto-error)",
            }}
          >
            <Clock className="size-4 shrink-0" aria-hidden />
            {restaurant.openState.label}. You can browse the menu, but orders
            aren&apos;t being taken right now.
          </p>
        </div>
      )}

      {/* Above the toolbar, not inside the paged list: it is a shortcut past
          the menu, and one that moved between pages would not be a shortcut.
          Hidden while filtering — a guest who is searching has told us what
          they want, and "trending" is no longer the answer to their question. */}
      {!isFiltering && (
        <>
          <RecommendedStrip
            items={recommended}
            variant="recommended"
            restaurantLogoUrl={restaurant.logoUrl}
            orderingDisabled={!isOpen}
            onSelect={handleAdd}
          />
          <RecommendedStrip
            items={favouritesStrip}
            variant="favourites"
            restaurantLogoUrl={restaurant.logoUrl}
            orderingDisabled={!isOpen}
            onSelect={handleAdd}
          />
        </>
      )}

      {/* Outside the !isFiltering guard the strips sit behind, and deliberately
          so: choosing a category *is* filtering, so hiding this on filter would
          delete the control the guest just used the moment they used it. It
          hides only for a text search, where the guest has already said what
          they want and browsing by category is no longer the question. */}
      {query.trim().length === 0 && (
        <CategoryCarousel
          categories={categories}
          activeCategoryId={categoryFilter}
          restaurantLogoUrl={restaurant.logoUrl}
          onSelect={(id) =>
            // Toggles, like the chips: tapping the category you are already in
            // is far more likely to mean "show me everything again" than a
            // mis-tap on the tile you just chose.
            changeFilter(() => setCategoryFilter(id === categoryFilter ? null : id))
          }
        />
      )}

      <div className="mt-6">
        <MenuToolbar
          categories={categories}
          query={query}
          onQueryChange={(value) => changeFilter(() => setQuery(value))}
          vegOnly={vegOnly}
          onVegOnlyChange={(value) => changeFilter(() => setVegOnly(value))}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={(id) => changeFilter(() => setCategoryFilter(id))}
        />
      </div>

      <main
        ref={listRef}
        className="mx-auto w-full max-w-[var(--resto-measure)] scroll-mt-32 px-4 py-8"
      >
        {categories.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed className="size-8" aria-hidden />}
            title="The menu isn't ready yet"
            body="Please check back shortly."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-8" aria-hidden />}
            title="No dishes match your search"
            body="Try a different name or clear the filters."
            action={
              isFiltering
                ? {
                    label: "Clear filters",
                    onClick: () =>
                      changeFilter(() => {
                        setQuery("");
                        setVegOnly(false);
                        setCategoryFilter(null);
                      }),
                  }
                : undefined
            }
          />
        ) : (
          <>
            {/* One flat grid rather than a section per category. The category
                name still prints above the first dish it owns on this page —
                headingBefore() decides where — so a guest keeps the structure
                without the page having to break on category boundaries. */}
            <ul className="grid gap-4 md:grid-cols-2">
              {visible.map((item, index) => {
                const heading = headingBefore(visible, index);
                const plainKey = cart.plainLineKey(item);

                return (
                  /* The heading gets its own grid cell rather than sharing the
                     card's. It used to be wrapped with the card in an <li
                     className="contents">, which put an <li> inside an <li> —
                     invalid, and browsers repair it by closing the outer one
                     early, so the DOM never matched the JSX. */
                  <Fragment key={item.id}>
                    {heading && (
                      <li className="md:col-span-2" role="presentation">
                        <h2
                          className="resto-display text-xl font-semibold"
                          style={{ color: "var(--resto-text)" }}
                        >
                          {heading}
                        </h2>
                      </li>
                    )}
                    <MenuItemCard
                      item={item}
                      quantity={cart.quantityByItem.get(item.id) ?? 0}
                      restaurantLogoUrl={restaurant.logoUrl}
                      orderingDisabled={!isOpen}
                      onAdd={() => handleAdd(item)}
                      onIncrement={() => handleAdd(item)}
                      onDecrement={() => cart.decrement(plainKey)}
                    />
                  </Fragment>
                );
              })}
            </ul>

            <p
              className="mt-6 text-center text-xs"
              style={{ color: "var(--resto-text-muted)" }}
              role="status"
            >
              {matched.length <= MENU_PAGE_SIZE
                ? `${matched.length} ${matched.length === 1 ? "dish" : "dishes"}`
                : `Showing ${(currentPage - 1) * MENU_PAGE_SIZE + 1}–${
                    (currentPage - 1) * MENU_PAGE_SIZE + visible.length
                  } of ${matched.length} dishes`}
            </p>

            <MenuPager page={currentPage} totalPages={totalPages} onPageChange={goToPage} />
          </>
        )}

        <ReviewsSection summary={restaurant.reviewSummary} />
      </main>

      <PlatformCredit />

      {cart.itemCount > 0 && panel === "none" && !optionsFor && (
        <CartBar
          itemCount={cart.itemCount}
          subtotal={cart.subtotal}
          onOpen={() => setPanel("cart")}
        />
      )}

      {optionsFor && (
        <ItemOptionsSheet
          item={optionsFor}
          onClose={() => setOptionsFor(null)}
          onConfirm={({ quantity, ...selection }) => {
            cart.add(selection, quantity);
            setOptionsFor(null);
          }}
        />
      )}

      {panel === "cart" && (
        <CartSheet
          lines={cart.lines}
          subtotal={cart.subtotal}
          onClose={() => setPanel("none")}
          onIncrement={cart.increment}
          onDecrement={cart.decrement}
          onCheckout={() => setPanel("checkout")}
        />
      )}

      {/* `customer` is guaranteed in practice — the arrival prompt blocks the
          menu until it is set — but the guard keeps the type honest and means
          a signed-out edge case degrades to the prompt, not a crash. */}
      {panel === "checkout" && customer && (
        <CheckoutSheet
          restaurant={restaurant}
          table={table}
          lines={cart.lines}
          customer={customer}
          onChangeIdentity={() => setShowAuth(true)}
          onClose={() => setPanel("cart")}
        />
      )}

      {showTrackOrder && (
        <TrackOrderDialog restaurant={restaurant} onClose={() => setShowTrackOrder(false)} />
      )}

      {/* The arrival prompt. Held back until the session check resolves so an
          already-signed-in guest never sees it, and non-dismissible because a
          number is what the rest of the flow is built on: checkout no longer
          asks for one. `showAuth` is the separate, cancellable "Change" path. */}
      {sessionChecked && !customer && !showAuth && (
        <CustomerAuthDialog
          restaurant={restaurant}
          dismissible={false}
          onSignedIn={(signedIn) => setCustomer(signedIn)}
          onClose={() => {}}
        />
      )}

      {showAuth && (
        <CustomerAuthDialog
          restaurant={restaurant}
          onSignedIn={(signedIn) => setCustomer(signedIn)}
          onClose={() => setShowAuth(false)}
        />
      )}

      {showHistory && customer && (
        <OrderHistoryDialog
          restaurant={restaurant}
          customerName={customer.name}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showMyRewards && customer && (
        <MyRewardsSheet
          restaurantSlug={restaurant.slug}
          customer={customer}
          onClose={() => setShowMyRewards(false)}
        />
      )}

      <RewardPopup
        restaurantSlug={restaurant.slug}
        customer={customer}
        onOpenMyRewards={() => setShowMyRewards(true)}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 border border-dashed py-16 text-center"
      style={{ borderColor: "var(--resto-border)", borderRadius: "var(--resto-radius-lg)" }}
    >
      <span style={{ color: "var(--resto-text-subtle)" }}>{icon}</span>
      <div>
        <p className="resto-display text-base font-semibold" style={{ color: "var(--resto-text)" }}>
          {title}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--resto-text-muted)" }}>
          {body}
        </p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--resto-brand-text)" }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
