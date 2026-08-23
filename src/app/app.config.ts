import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withDebugTracing } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { IngestionSchedulerService } from './core/ingestion/ingestion-scheduler.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideFirebaseApp(() => {
      if (!environment?.firebaseConfig) {
        throw new Error('Firebase configuration is missing. Please ensure `firebaseConfig` is defined and exported in `src/environments/environment.ts`.');
      }
      return initializeApp(environment.firebaseConfig);
    }),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
    // Phase 1: the in-client ingestion scheduler starts on bootstrap. It is
    // wired via an app initializer (not a service constructor) so injecting
    // a service never fires network traffic on its own.
    provideAppInitializer(() => {
      const scheduler = inject(IngestionSchedulerService);
      scheduler.start();
    }),
  ],
};
