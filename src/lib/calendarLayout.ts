import { CalendarEvent } from '../types';

export interface PositionedEvent extends CalendarEvent {
  left: number; // percentage 0-100
  width: number; // percentage 0-100
}

/**
 * Calculates the horizontal positioning for overlapping events.
 * Returns a list of events with 'left' and 'width' properties as percentages.
 */
export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  // Sort events by start time, then by end time (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    return b.endTime - a.endTime;
  });

  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  // Group events into clusters of overlapping events
  for (const event of sortedEvents) {
    if (event.startTime >= clusterEnd) {
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }
      currentCluster = [event];
      clusterEnd = event.endTime;
    } else {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.endTime);
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedEvent[] = [];

  for (const cluster of clusters) {
    const columns: CalendarEvent[][] = [];
    
    for (const event of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const lastEventInColumn = columns[i][columns[i].length - 1];
        if (event.startTime >= lastEventInColumn.endTime) {
          columns[i].push(event);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([event]);
      }
    }

    const columnCount = columns.length;
    for (let i = 0; i < columns.length; i++) {
      for (const event of columns[i]) {
        result.push({
          ...event,
          left: (i / columnCount) * 100,
          width: (1 / columnCount) * 100,
        });
      }
    }
  }

  return result;
}
