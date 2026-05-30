import type { Meta, StoryObj } from '@storybook/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

const meta: Meta = {
  title: 'UI/Select',
  tags: ['autodocs'],
};

export default meta;

const OPTIONS = ['Wedding', 'Corporate', 'Private', 'Festival', 'Residency'];

export const Placeholder: StoryObj = {
  render: () => (
    <Select>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Choose event type" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  ),
};

export const WithValue: StoryObj = {
  render: () => (
    <Select defaultValue="Wedding">
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Unavailable" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  ),
};
