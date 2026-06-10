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
    <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full rounded-none bg-transparent border-b border-border h-auto p-0 gap-0">
          <TabsTrigger
            value="checklist"
            className="flex-1 rounded-none bg-transparent shadow-none border-b-2 border-transparent text-muted py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            Checklist
          </TabsTrigger>
          <TabsTrigger
            value="onTheDay"
            className="flex-1 rounded-none bg-transparent shadow-none border-b-2 border-transparent text-muted py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            On the Day
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="flex-1 rounded-none bg-transparent shadow-none border-b-2 border-transparent text-muted py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            Info
          </TabsTrigger>
        </TabsList>
        <TabsContent value="checklist" className="data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200">{checklist}</TabsContent>
        <TabsContent value="onTheDay" className="data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200">{onTheDay}</TabsContent>
        <TabsContent value="info" className="data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-200">{info}</TabsContent>
      </Tabs>
  );
}
