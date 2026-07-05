import { Injectable } from '@nestjs/common';
import { DistanceMatrixClient, DistanceResult } from './distance-matrix.client';

// Fixed-distance stand-in for the Google Maps Distance Matrix client, used only
// when E2E_TEST_MODE is on (ADR-0048 §4). Extends the real client so it shares
// the DI token; `onModuleInit` is a no-op so the missing GOOGLE_MAPS_API_KEY
// doesn't throw at boot, and `getDistance` returns a deterministic result.
@Injectable()
export class FixedDistanceMatrixClient extends DistanceMatrixClient {
  override onModuleInit(): void {
    // no Google Maps key required in test mode
  }

  override getDistance(): Promise<DistanceResult> {
    return Promise.resolve({ minutes: 30, distanceMetres: 20000 });
  }
}
