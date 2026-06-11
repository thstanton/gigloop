import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ContactPicker from '@/features/bookings/ContactPicker';
import { apiPatch } from '@/lib/api';

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
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add venue</DialogTitle>
          </DialogHeader>
          <ContactPicker
            value={null}
            onChange={(id) => { if (id) mutation.mutate(id); }}
            placeholder="Select venue..."
            label="venue"
            preferredRole="VENUE"
          />
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
