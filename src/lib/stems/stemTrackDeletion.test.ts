import { describe, expect, it } from 'vitest';
import {
  addDeletedStemType,
  filterDeletedStems,
  normalizeDeletedStemTypes,
} from './stemTrackDeletion';

const stems = [
  { type: 'vocals' },
  { type: 'drums' },
  { type: 'bass' },
];

describe('stem track deletion helpers', () => {
  it('filters original stems that were marked as deleted', () => {
    expect(filterDeletedStems(stems, ['drums'])).toEqual([
      { type: 'vocals' },
      { type: 'bass' },
    ]);
  });

  it('keeps deleted stem types unique and limited to known original stems', () => {
    expect(normalizeDeletedStemTypes(['drums', 'missing', 'drums', 'bass'], stems)).toEqual(['drums', 'bass']);
    expect(addDeletedStemType(['drums'], 'vocals', stems)).toEqual(['drums', 'vocals']);
    expect(addDeletedStemType(['drums'], 'missing', stems)).toEqual(['drums']);
  });
});
