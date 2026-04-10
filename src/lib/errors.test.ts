import { describe, it, expect, vi } from 'vitest';
import { handleLoaderError, handleMutationError } from './errors';

describe('handleLoaderError', () => {
  it('returns the provided fallback value', () => {
    const fallback = [{ id: 'test' }];
    const result = handleLoaderError('test-context', new Error('fail'), fallback);
    expect(result).toBe(fallback);
  });

  it('returns empty array fallback', () => {
    const result = handleLoaderError('contacts', { message: 'DB error' }, []);
    expect(result).toEqual([]);
  });

  it('logs the error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleLoaderError('contacts', new Error('connection failed'), []);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[Loader:contacts]'),
      expect.anything()
    );
    spy.mockRestore();
  });
});

describe('handleMutationError', () => {
  it('logs the error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleMutationError('journal:submit', new Error('insert failed'));
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[Mutation:journal:submit]'),
      expect.anything()
    );
    spy.mockRestore();
  });

  it('calls optional onError callback with message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    handleMutationError('test', new Error('oops'), onError);
    expect(onError).toHaveBeenCalledWith('oops');
    spy.mockRestore();
  });

  it('handles non-Error objects gracefully', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handleMutationError('test', { message: 'pg error', code: '23505' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('pg error'),
      expect.anything()
    );
    spy.mockRestore();
  });
});
