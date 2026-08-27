"use client";

import { Printer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CompletableOrder = {
  id: string;
  orderNumber: number;
};

export function CompleteOrderDialog({
  order,
  onOpenChange,
  onConfirm,
}: {
  order: CompletableOrder | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (printBill: boolean) => void;
}) {
  return (
    <Dialog open={order !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete Order #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            This order has been paid and handed over. Do you want to print a receipt for the customer?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onConfirm(false)}
          >
            <Check className="size-4 mr-2" />
            Complete only
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => onConfirm(true)}
          >
            <Printer className="size-4 mr-2" />
            Complete & Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

