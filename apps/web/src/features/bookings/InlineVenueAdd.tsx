import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import ContactPicker from '@/features/bookings/ContactPicker';
import { apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';

export function InlineVenueAdd({ bookingId }: { bookingId: string }) {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (id: string) => apiPatch(`/bookings/${bookingId}`, { venueId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSheetOpen(false);
    },
    onError: () => toast({ title: 'Failed to add venue', variant: 'destructive' }),
  });

  return (
    <>
      <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
        <MapPin size={20} />
        <span className="text-sm font-medium">Venue</span>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          + Add
        </button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Add venue</SheetTitle>
          </SheetHeader>
          <ContactPicker
            value={null}
            onChange={(id) => { if (id) mutation.mutate(id); }}
            placeholder="Select venue..."
            label="venue"
            preferredRole="VENUE"
            disabled={mutation.isPending}
          />
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
