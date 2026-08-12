"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestaurantForm, type AdminRestaurant } from "@/components/restaurant/admin/restaurant-form";

export function RestaurantsTable({ initialRestaurants }: { initialRestaurants: AdminRestaurant[] }) {
  const [restaurants, setRestaurants] = useState(initialRestaurants);

  async function toggleActive(restaurant: AdminRestaurant) {
    const previous = restaurants;
    const nextActive = !restaurant.isActive;
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurant.id ? { ...r, isActive: nextActive } : r))
    );

    const res = await fetch(`/api/admin/restaurants/${restaurant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive }),
    });

    if (!res.ok) {
      setRestaurants(previous);
      toast.error("Could not update restaurant");
      return;
    }
    toast.success(nextActive ? "Restaurant enabled" : "Restaurant disabled");
  }

  return (
    <div className="flex flex-col gap-4">
      <RestaurantForm
        onCreated={(restaurant) => setRestaurants((prev) => [restaurant, ...prev])}
        trigger={
          <Button type="button" size="sm" className="self-end">
            <Plus /> Add restaurant
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(24,24,20,0.04),0_8px_20px_-12px_rgba(24,24,20,0.10)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Owner login</TableHead>
                <TableHead className="text-right">Menu</TableHead>
                <TableHead className="text-right">Tables</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Right now</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No restaurants yet — add your first one to get started.
                  </TableCell>
                </TableRow>
              )}
              {restaurants.map((restaurant) => (
                <TableRow key={restaurant.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{restaurant.name}</span>
                      <Link
                        href={`/order/${restaurant.slug}`}
                        target="_blank"
                        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                      >
                        /order/{restaurant.slug}
                        <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {restaurant.branch ? (
                      <Badge variant="secondary">{restaurant.branch}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {restaurant.ownerEmail ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {restaurant.menuItemCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{restaurant.tableCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{restaurant.orderCount}</TableCell>
                  {/* Open/closed in the restaurant's own timezone, resolved by
                      the API. Separate from the Active switch beside it: a live
                      restaurant is closed most of the night, and reading only
                      "Live" here used to hide that entirely. */}
                  <TableCell className="text-sm">
                    {restaurant.openState ? (
                      <div className="flex flex-col">
                        <Badge
                          variant={restaurant.openState.isOpen ? "default" : "secondary"}
                          className="w-fit"
                        >
                          {restaurant.openState.isOpen ? "Open" : "Closed"}
                        </Badge>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                          {restaurant.openState.label}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={restaurant.isActive}
                        onCheckedChange={() => toggleActive(restaurant)}
                        aria-label={`Toggle ${restaurant.name}`}
                      />
                      <Badge variant={restaurant.isActive ? "default" : "secondary"}>
                        {restaurant.isActive ? "Live" : "Paused"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Manage ${restaurant.name}`}
                      render={<Link href={`/admin/restaurants/${restaurant.id}`} />}
                    >
                      <Settings2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
