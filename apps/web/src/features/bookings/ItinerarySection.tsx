import { BuilderSection } from '@/features/bookings/BuilderSection';
import { ItineraryAtom } from '@/features/bookings/ItineraryAtom';
import { NO_PACKAGE } from '@/features/bookings/ItineraryFields';
import type { BookingDetail, BookingLogisticsEntry, PackageTemplate } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function ItinerarySection({
  booking,
  bookingId,
  templates,
  templatesLoading,
  mutations,
  refCallback,
}: {
  booking: BookingDetail;
  bookingId: string;
  templates: PackageTemplate[];
  templatesLoading: boolean;
  mutations: ReturnType<typeof useBookingBuilderMutations>;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  const {
    addSet, updateSet, deleteSet, moveSet, updatePackage, removePackage,
    itineraryApplyTemplate, saveAnchors,
  } = mutations;
  const addingKey = addSet.isPending ? (addSet.variables?.packageId ?? NO_PACKAGE) : null;
  return (
    <BuilderSection
      id="itinerary"
      title="Itinerary"
      refCallback={refCallback}
      remind={{ bookingId, concern: 'itinerary', currentStatus: booking.status }}
    >
      <ItineraryAtom
        sets={booking.sets}
        packages={booking.packages}
        initialLogistics={booking.logistics}
        eventType={booking.eventType}
        templates={templates}
        templatesLoading={templatesLoading}
        onAddSet={(packageId, values) => addSet.mutate({ packageId, values })}
        onUpdateSet={(setId, values) => updateSet.mutate({ setId, values })}
        onDeleteSet={(setId) => deleteSet.mutate(setId)}
        onMoveSet={(setId, packageId) => moveSet.mutate({ setId, packageId })}
        onApplyTemplate={(templateId) => itineraryApplyTemplate.mutate(templateId)}
        onUpdatePackage={(packageId, dto) => updatePackage.mutate({ packageId, dto })}
        onRemovePackage={(packageId) => removePackage.mutate(packageId)}
        onSaveAnchors={(anchors: Record<string, BookingLogisticsEntry>) => saveAnchors.mutate(anchors)}
        savingSetId={updateSet.isPending ? updateSet.variables?.setId ?? null : null}
        deletingSetId={deleteSet.isPending ? deleteSet.variables ?? null : null}
        movingSetId={moveSet.isPending ? moveSet.variables?.setId ?? null : null}
        addingKey={addingKey}
        isApplyingTemplate={itineraryApplyTemplate.isPending}
        removingPackageId={removePackage.isPending ? removePackage.variables ?? null : null}
        anchorsSaving={saveAnchors.isPending}
        anchorsSaved={saveAnchors.isSuccess}
        anchorsError={saveAnchors.isError ? 'Failed to save times. Please try again.' : null}
      />
    </BuilderSection>
  );
}
