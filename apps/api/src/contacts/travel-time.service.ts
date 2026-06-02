import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { DistanceMatrixClient } from './distance-matrix.client';
import { TravelTimeResponseDto } from './dto/travel-time-response.dto';

@Injectable()
export class TravelTimeService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly userProfileRepo: UserProfileRepository,
    private readonly distanceMatrix: DistanceMatrixClient,
  ) {}

  async getTravelTime(userId: string, contactId: string): Promise<TravelTimeResponseDto> {
    const contact = await this.contactsRepo.findOne(userId, contactId);

    if (!contact) {
      throw new UnprocessableEntityException('Contact not found');
    }

    if (contact.travelTimeCalculatedAt) {
      return {
        minutes: contact.travelTimeMinutes!,
        distanceMetres: contact.travelDistanceMetres!,
        calculatedAt: contact.travelTimeCalculatedAt.toISOString(),
      };
    }

    if (!contact.latitude || !contact.longitude) {
      throw new UnprocessableEntityException('Venue address not set');
    }

    const profile = await this.userProfileRepo.upsertByUserId(userId);
    if (!profile.latitude || !profile.longitude) {
      throw new UnprocessableEntityException(
        'Home address not set — add it in Settings to see travel time',
      );
    }

    const { minutes, distanceMetres } = await this.distanceMatrix.getDistance(
      { lat: profile.latitude as number, lng: profile.longitude as number },
      { lat: contact.latitude, lng: contact.longitude },
    );

    const calculatedAt = new Date();
    await this.contactsRepo.updateTravelTime(contactId, {
      travelTimeMinutes: minutes,
      travelDistanceMetres: distanceMetres,
      travelTimeCalculatedAt: calculatedAt,
      travelMode: 'DRIVING',
    });

    return { minutes, distanceMetres, calculatedAt: calculatedAt.toISOString() };
  }

  async clearAllForUser(userId: string): Promise<void> {
    await this.contactsRepo.clearTravelTimeForUser(userId);
  }
}
