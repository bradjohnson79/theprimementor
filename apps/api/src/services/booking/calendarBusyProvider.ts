export interface BusyRange {
  startUtc: Date;
  endUtc: Date;
  source: "calendar";
}

export interface BusyRangeQuery {
  windowStartUtc: Date;
  windowEndUtc: Date;
}

export interface CalendarBusyProvider {
  getBusyRanges(query: BusyRangeQuery): Promise<BusyRange[]>;
}

class NoopCalendarBusyProvider implements CalendarBusyProvider {
  async getBusyRanges(_query: BusyRangeQuery): Promise<BusyRange[]> {
    return [];
  }
}

export const calendarBusyProvider: CalendarBusyProvider = new NoopCalendarBusyProvider();
