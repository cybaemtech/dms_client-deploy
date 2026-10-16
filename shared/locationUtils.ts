/**
 * Location parsing and overlap utilities for Document Management System (DMS).
 *
 * Rules:
 * 1. Locations are stored either as comma-separated units (e.g. "Unit 1, Unit 2, Unit 3", "Unit 1", "HO")
 *    or as "Common" / "All" / null / empty string.
 * 2. Empty string, null, "Common", or "All" implies ALL locations, meaning it overlaps with everything.
 * 3. Specific unit lists overlap if they share AT LEAST ONE unit in common (e.g. "Unit 1" and "Unit 1, Unit 2, Unit 3" share "Unit 1").
 * 4. Locations only DO NOT overlap if their unit sets are completely disjoint (e.g. "Unit 1" vs "Unit 2, Unit 3").
 */

export function parseLocations(loc?: string | null): string[] {
  if (!loc) return ['all'];
  const trimmed = loc.trim().toLowerCase();
  if (!trimmed || trimmed === 'all' || trimmed === 'common') {
    return ['all'];
  }
  const parts = loc
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0 || parts.includes('all') || parts.includes('common')) {
    return ['all'];
  }
  return parts;
}

export function locationsOverlap(loc1?: string | null, loc2?: string | null): boolean {
  // If either location is unspecified/undefined, treat as matching all locations
  if (loc1 === undefined || loc2 === undefined) {
    return true;
  }

  const list1 = parseLocations(loc1);
  const list2 = parseLocations(loc2);

  // If either applies to all locations, they overlap
  if (list1.includes('all') || list2.includes('all')) {
    return true;
  }

  // Otherwise, overlap if they share at least one unit
  return list1.some(l1 => list2.includes(l1));
}

export function getOverlappingUnits(loc1?: string | null, loc2?: string | null): string[] {
  const list1 = parseLocations(loc1);
  const list2 = parseLocations(loc2);

  if (list1.includes('all') && list2.includes('all')) {
    return ['All Locations'];
  }
  if (list1.includes('all')) {
    return list2.map(formatUnitName);
  }
  if (list2.includes('all')) {
    return list1.map(formatUnitName);
  }

  const common = list1.filter(l1 => list2.includes(l1));
  return common.map(formatUnitName);
}

function formatUnitName(u: string): string {
  if (u.toLowerCase() === 'ho') return 'HO';
  if (u.toLowerCase() === 'all') return 'All Locations';
  // Capitalize words (e.g., "unit 1" -> "Unit 1")
  return u
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Filter documents to only keep the latest revision per document number for overlapping locations.
 * If two documents have the same docNumber and overlapping locations, only the one with the highest revisionNo
 * (or newest createdAt if revisionNo is identical) is kept.
 */
export function filterLatestDocuments<T extends {
  docNumber?: string | null;
  location?: string | null;
  revisionNo?: number | null;
  createdAt?: Date | string | null;
}>(documents: T[]): T[] {
  if (!documents || documents.length === 0) return [];

  // Sort by revisionNo DESC, then createdAt DESC
  const sorted = [...documents].sort((a, b) => {
    const revA = a.revisionNo !== undefined && a.revisionNo !== null ? Number(a.revisionNo) : -1;
    const revB = b.revisionNo !== undefined && b.revisionNo !== null ? Number(b.revisionNo) : -1;
    if (revB !== revA) return revB - revA;

    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const kept: T[] = [];
  for (const doc of sorted) {
    const docNum = (doc.docNumber || '').trim().toLowerCase();
    if (!docNum) {
      kept.push(doc);
      continue;
    }

    // Check if an already kept document has the same docNumber and overlapping location
    const hasNewerOverlapping = kept.some(k => {
      const kDocNum = (k.docNumber || '').trim().toLowerCase();
      if (kDocNum !== docNum) return false;
      return locationsOverlap(k.location, doc.location);
    });

    if (!hasNewerOverlapping) {
      kept.push(doc);
    }
  }

  // Restore chronological sorting by createdAt DESC
  return kept.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}
