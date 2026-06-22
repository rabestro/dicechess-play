import { describe, it, expect, beforeEach, vi } from 'vitest';
import { preferencesStore } from './preferencesStore.svelte';

describe('PreferencesStore', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value.toString(); }),
      clear: vi.fn(() => { store = {}; }),
      removeItem: vi.fn((key: string) => { delete store[key]; })
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    expect(preferencesStore.preferredMode).toBe('view');
    expect(preferencesStore.gamesPerPage).toBe(25);
    expect(preferencesStore.archiveOnFinish).toBe(true);
  });

  it('should persist preferredMode', () => {
    preferencesStore.setMode('train');
    expect(preferencesStore.preferredMode).toBe('train');
    expect(localStorage.getItem('preferredMode')).toBe('train');
  });

  it('should persist gamesPerPage', () => {
    preferencesStore.setGamesPerPage(50);
    expect(preferencesStore.gamesPerPage).toBe(50);
    expect(localStorage.getItem('gamesPerPage')).toBe('50');
  });

  it('should persist archiveOnFinish', () => {
    preferencesStore.setArchiveOnFinish(false);
    expect(preferencesStore.archiveOnFinish).toBe(false);
    expect(localStorage.getItem('archiveOnFinish')).toBe('false');

    preferencesStore.setArchiveOnFinish(true);
    expect(preferencesStore.archiveOnFinish).toBe(true);
    expect(localStorage.getItem('archiveOnFinish')).toBe('true');
  });

  it('should persist and guard botLobbyBet and botLobbyMode', () => {
    // Default values
    expect(preferencesStore.botLobbyBet).toBe(0);
    expect(preferencesStore.botLobbyMode).toBe('classic');

    // Setting bet to a non-zero value should allow setting x2 mode
    preferencesStore.setBotLobbyBet(3);
    expect(preferencesStore.botLobbyBet).toBe(3);
    expect(localStorage.getItem('botLobbyBet')).toBe('3');

    preferencesStore.setBotLobbyMode('x2');
    expect(preferencesStore.botLobbyMode).toBe('x2');
    expect(localStorage.getItem('botLobbyMode')).toBe('x2');

    // Switching bet back to 0 (FREE) should force mode back to classic
    preferencesStore.setBotLobbyBet(0);
    expect(preferencesStore.botLobbyBet).toBe(0);
    expect(preferencesStore.botLobbyMode).toBe('classic');
    expect(localStorage.getItem('botLobbyMode')).toBe('classic');

    // Trying to set mode to x2 when bet is 0 should be guarded and forced to classic
    preferencesStore.setBotLobbyMode('x2');
    expect(preferencesStore.botLobbyMode).toBe('classic');
  });
});
