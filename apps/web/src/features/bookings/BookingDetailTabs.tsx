import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface BookingDetailTabsProps {
  defaultTab: 'checklist' | 'onTheDay' | 'info';
  checklist: ReactNode;
  onTheDay: ReactNode;
  info: ReactNode;
}

export default function BookingDetailTabs({ defaultTab, checklist, onTheDay, info }: BookingDetailTabsProps) {
  return (
    <div className="md:hidden">
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full">
          <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
          <TabsTrigger value="onTheDay" className="flex-1">On the Day</TabsTrigger>
          <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
        </TabsList>
        <TabsContent value="checklist">{checklist}</TabsContent>
        <TabsContent value="onTheDay">{onTheDay}</TabsContent>
        <TabsContent value="info">{info}</TabsContent>
      </Tabs>
    </div>
  );
}
