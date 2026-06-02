import { Injectable } from '@nestjs/common';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  minutes: number;
  distanceMetres: number;
}

interface DistanceMatrixApiResponse {
  rows: Array<{
    elements: Array<{
      status: string;
      duration: { value: number; text: string };
      distance: { value: number; text: string };
    }>;
  }>;
}

@Injectable()
export class DistanceMatrixClient {
  async getDistance(origin: LatLng, destination: LatLng): Promise<DistanceResult> {
    const key = process.env.GOOGLE_MAPS_API_KEY ?? '';
    const params = new URLSearchParams({
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      mode: 'driving',
      key,
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
    );
    if (!res.ok) throw new Error(`Distance Matrix API error: ${res.status}`);
    const data = (await res.json()) as DistanceMatrixApiResponse;
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new Error(
        `Distance Matrix returned status: ${element?.status ?? 'unknown'}`,
      );
    }
    return {
      minutes: Math.round(element.duration.value / 60),
      distanceMetres: element.distance.value,
    };
  }
}
