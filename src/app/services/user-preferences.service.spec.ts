import { TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;

  beforeEach(() => {
    localStorage.clear();
    // Firestore provider is required for injection even though these tests
    // never touch it (the service is storage-backed only).
    TestBed.configureTestingModule({
      providers: [
        provideFirebaseApp(() => initializeApp({ projectId: 'test', appId: 'test' })),
        provideFirestore(() => getFirestore()),
      ],
    });
    service = TestBed.inject(UserPreferencesService);
  });

  it('persists hidden widgets and restores them via loadPreferences', () => {
    service.setHiddenWidgets(['movers']);
    service.setWidgetOrder(['news', 'index']);

    const fresh = new (Object.getPrototypeOf(service).constructor as typeof UserPreferencesService)();
    fresh.loadPreferences();

    expect(fresh.getPreferencesValue().hiddenWidgets).toEqual(['movers']);
    expect(fresh.getPreferencesValue().widgetOrder).toEqual(['news', 'index']);
  });
});
