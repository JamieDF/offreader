import { describe, it, expect } from 'vitest';
import { titleCase } from '@/utils/titleCase';

describe('titleCase', () => {
  it('capitalises the first word even if it is a stop word', () => {
    expect(titleCase('the great gatsby')).toBe('The Great Gatsby');
    expect(titleCase('a tale of two cities')).toBe('A Tale of Two Cities');
  });

  it('lowercases stop words in the middle of a string', () => {
    expect(titleCase('harry potter and the philosopher stone')).toBe(
      'Harry Potter and the Philosopher Stone'
    );
    expect(titleCase('war and peace')).toBe('War and Peace');
  });

  it('always uppercases single-letter words', () => {
    expect(titleCase('plan a or b')).toBe('Plan A or B');
  });

  it('returns empty string unchanged', () => {
    expect(titleCase('')).toBe('');
  });

  it('handles null gracefully', () => {
    // titleCase(null) is called as any so we cast for the test
    expect(titleCase(null as unknown as string)).toBeNull();
  });

  it('handles undefined gracefully', () => {
    expect(titleCase(undefined as unknown as string)).toBeUndefined();
  });

  it('lowercases fully-uppercase input correctly', () => {
    expect(titleCase('THE GREAT GATSBY')).toBe('The Great Gatsby');
  });

  it('collapses multiple spaces (splits on /\\s+/)', () => {
    expect(titleCase('hello   world')).toBe('Hello World');
  });

  it('capitalises non-stop words after stop words', () => {
    expect(titleCase('pride and prejudice')).toBe('Pride and Prejudice');
  });
});
