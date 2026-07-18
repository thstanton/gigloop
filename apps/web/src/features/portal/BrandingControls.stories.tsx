import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  ThemeCards,
  BrandColourControl,
  HeroImagePicker,
  type PortalHeroImage,
} from './BrandingControls';
import type { PortalTheme } from '@/types/api';

// Mirrors how consumers compose the controls: the hero picker only appears for
// Bold themes.
function StatefulControls() {
  const [theme, setTheme] = useState<PortalTheme>('LIGHT_MODERN');
  const [brandColour, setBrandColour] = useState('#2d5a3d');
  const [heroImage, setHeroImage] = useState<PortalHeroImage>(null);
  const bold = theme === 'BOLD_MODERN' || theme === 'BOLD_ROMANTIC';

  return (
    <div className="max-w-md space-y-6 p-4">
      <ThemeCards value={theme} onChange={setTheme} />
      {bold && (
        <HeroImagePicker value={heroImage} brandColour={brandColour} onChange={setHeroImage} />
      )}
      <BrandColourControl value={brandColour} onChange={setBrandColour} />
    </div>
  );
}

const meta = {
  component: StatefulControls,
  tags: ['ai-generated'],
} satisfies Meta<typeof StatefulControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // All four theme cards render; no hero picker for a Light theme
    await expect(canvas.getByText('Light Modern')).toBeVisible();
    await expect(canvas.getByText('Bold Romantic')).toBeVisible();
    await expect(canvas.queryByText('None (brand colour)')).not.toBeInTheDocument();
    await expect(canvas.getByLabelText('Brand colour hex')).toHaveValue('#2d5a3d');

    // Picking a Bold theme reveals the hero image picker
    await userEvent.click(canvas.getByText('Bold Modern'));
    await expect(canvas.getByText('None (brand colour)')).toBeVisible();
    await userEvent.click(canvas.getByText('stage'));

    // Back to a Light theme hides it again
    await userEvent.click(canvas.getByText('Light Romantic'));
    await expect(canvas.queryByText('None (brand colour)')).not.toBeInTheDocument();
  },
};
