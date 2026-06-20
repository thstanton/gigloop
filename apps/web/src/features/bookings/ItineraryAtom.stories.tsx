import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ItineraryAtom } from './ItineraryAtom';
import type { BookingPackageSummary, PackageTemplate, PerformanceSet } from '@/types/api';

// The Itinerary atom is presentational: it owns no mutation and no fetch. The host passes the
// sets/packages/templates and the booking's logistics; the atom signals every edit via a callback.
// These stories assert the build-a-running-order happy path and the Tier-1 / Tier-2 loading states.

const packages: BookingPackageSummary[] = [{ id: 'pkg-evening', order: 1, label: 'Evening', icon: 'guitar' }];

const sets: PerformanceSet[] = [
  { id: 'set-1', order: 1, duration: 45, startTime: '19:30', label: 'First set', packageId: 'pkg-evening' },
  { id: 'set-2', order: 2, duration: 45, startTime: '21:00', label: 'Second set', packageId: 'pkg-evening' },
  { id: 'set-3', order: 3, duration: 90, startTime: '17:00', label: 'Background', packageId: null },
];

const templates: PackageTemplate[] = [
  {
    id: 'tmpl-wedding', createdAt: '', updatedAt: '', label: 'Wedding set', category: 'WEDDING', icon: 'heart',
    keyMoments: [], defaultGenreSelection: [], notes: null, isSystemDefault: false, enabled: true, slots: [],
  },
  {
    id: 'tmpl-corporate', createdAt: '', updatedAt: '', label: 'Corporate set', category: 'CORPORATE', icon: 'briefcase',
    keyMoments: [], defaultGenreSelection: [], notes: null, isSystemDefault: false, enabled: true, slots: [],
  },
];

const meta = {
  component: ItineraryAtom,
  tags: ['ai-generated'],
  args: {
    sets,
    packages,
    initialLogistics: null,
    eventType: 'WEDDING',
    templates,
    templatesLoading: false,
    onAddSet: fn(),
    onUpdateSet: fn(),
    onDeleteSet: fn(),
    onMoveSet: fn(),
    onApplyTemplate: fn(),
    onUpdatePackage: fn(),
    onRemovePackage: fn(),
    onSaveAnchors: fn(),
  },
} satisfies Meta<typeof ItineraryAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Anchors, package box, and an ungrouped box in one surface',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The three operational anchors…
    await expect(canvas.getByLabelText('Arrival time')).toBeVisible();
    await expect(canvas.getByLabelText('Finish time')).toBeVisible();
    // …the package box (editable name) and its sets as collapsed rows…
    await expect(canvas.getByLabelText('Package name')).toHaveValue('Evening');
    await expect(canvas.getByText('First set')).toBeVisible();
    // …and the ungrouped box.
    await expect(canvas.getByText('No package')).toBeVisible();
    // Nothing changed yet, so the anchors' Save is disabled.
    await expect(canvas.getByRole('button', { name: /save times/i })).toBeDisabled();
  },
};

export const SaveAnchors: Story = {
  name: 'Editing an anchor enables Save and emits only the time slice (inverse merge)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Arrival time'), '17:30');

    const save = canvas.getByRole('button', { name: /save times/i });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    await expect(args.onSaveAnchors).toHaveBeenCalledWith({
      arrivalTime: { value: '17:30', shareWithBand: false, shareWithClient: false },
    });
  },
};

export const AddSetToPackage: Story = {
  name: 'The persistent add form emits the new set with the box’s package id',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // First box is the Evening package; its add form is the first one.
    const labelInputs = canvas.getAllByLabelText('New set label');
    await userEvent.type(labelInputs[0], 'Encore');
    await userEvent.type(canvas.getAllByLabelText('New set start time')[0], '22:30');

    await userEvent.click(canvas.getAllByRole('button', { name: /^add set$/i })[0]);
    await expect(args.onAddSet).toHaveBeenCalledWith('pkg-evening', {
      label: 'Encore',
      duration: 30,
      startTime: '22:30',
    });
  },
};

export const AddUngroupedSet: Story = {
  name: 'The ungrouped box emits a set with no package',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const labelInputs = canvas.getAllByLabelText('New set label');
    await userEvent.type(labelInputs[labelInputs.length - 1], 'Warm-up');

    const addButtons = canvas.getAllByRole('button', { name: /^add set$/i });
    await userEvent.click(addButtons[addButtons.length - 1]);
    await expect(args.onAddSet).toHaveBeenCalledWith(null, {
      label: 'Warm-up',
      duration: 30,
      startTime: null,
    });
  },
};

export const EditSet: Story = {
  name: 'Expanding a row and editing commits on blur',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Expand the first set's collapsed summary.
    await userEvent.click(canvas.getByText('First set'));
    const label = canvas.getByLabelText('Set label');
    await userEvent.clear(label);
    await userEvent.type(label, 'Opening set');
    // Blur the whole editor by focusing something outside it.
    await userEvent.click(canvas.getByLabelText('Arrival time'));
    await expect(args.onUpdateSet).toHaveBeenCalledWith('set-1', {
      label: 'Opening set',
      duration: 45,
      startTime: '19:30',
    });
  },
};

export const MoveSetToUngrouped: Story = {
  name: 'The Package dropdown re-parents a set (null = ungrouped)',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('First set'));
    const select = canvas.getByLabelText('Package');
    await userEvent.selectOptions(select, canvas.getByRole('option', { name: 'No package' }));
    await expect(args.onMoveSet).toHaveBeenCalledWith('set-1', null);
  },
};

export const CopyPrefillsAddForm: Story = {
  name: 'Copy prefills that box’s add form with the values, minus the time',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Copy the first set (in the Evening box).
    await userEvent.click(canvas.getAllByLabelText('Copy set')[0]);
    // The Evening box's add form (first) is prefilled — label copied, time cleared.
    await expect(canvas.getAllByLabelText('New set label')[0]).toHaveValue('First set');
    await expect(canvas.getAllByLabelText('New set start time')[0]).toHaveValue('');
  },
};

export const EditPackageHeader: Story = {
  name: 'Renaming the package header commits on blur',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const name = canvas.getByLabelText('Package name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Evening party');
    await userEvent.click(canvas.getByLabelText('Arrival time'));
    await expect(args.onUpdatePackage).toHaveBeenCalledWith('pkg-evening', { label: 'Evening party' });
  },
};

export const ApplyTemplate: Story = {
  name: 'Add package — event-type matches lead',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /add package/i }));
    await userEvent.click(canvas.getByRole('button', { name: /wedding set/i }));
    await expect(args.onApplyTemplate).toHaveBeenCalledWith('tmpl-wedding');
  },
};

export const SetSavingState: Story = {
  name: 'Tier-1: an expanded row shows “Saving…” while it persists',
  args: { savingSetId: 'set-1' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('First set'));
    await expect(canvas.getByText('Saving…')).toBeVisible();
  },
};

export const AddingSetState: Story = {
  name: 'Tier-2: the box persisting an add relabels and disables its button',
  args: { addingKey: 'pkg-evening' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const add = canvas.getByRole('button', { name: /adding…/i });
    await expect(add).toBeVisible();
    await expect(add).toBeDisabled();
  },
};

export const AnchorsSavedState: Story = {
  name: 'Tier-1: anchors success shows an inline “Saved”',
  args: { anchorsSaved: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const AnchorsErrorState: Story = {
  name: 'Tier-1: anchors failure shows an inline error',
  args: { anchorsError: 'Failed to save times. Please try again.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/failed to save times/i)).toBeVisible();
  },
};
