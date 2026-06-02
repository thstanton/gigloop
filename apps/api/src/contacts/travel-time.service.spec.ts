import { UnprocessableEntityException } from '@nestjs/common';
import { TravelTimeService } from './travel-time.service';
import { ContactsRepository } from './contacts.repository';
import { UserProfileRepository } from '../user-profile/user-profile.repository';
import { DistanceMatrixClient } from './distance-matrix.client';

type MockContactsRepo = {
  findOne: jest.Mock;
  updateTravelTime: jest.Mock;
  clearTravelTimeForUser: jest.Mock;
};

type MockUserProfileRepo = {
  upsertByUserId: jest.Mock;
};

type MockDistanceMatrix = {
  getDistance: jest.Mock;
};

function makeContactsRepo(): MockContactsRepo {
  return {
    findOne: jest.fn(),
    updateTravelTime: jest.fn(),
    clearTravelTimeForUser: jest.fn(),
  };
}

function makeUserProfileRepo(): MockUserProfileRepo {
  return { upsertByUserId: jest.fn() };
}

function makeDistanceMatrix(): MockDistanceMatrix {
  return { getDistance: jest.fn() };
}

const venueContact = {
  id: 'c1',
  userId: 'u1',
  primaryRole: 'VENUE',
  latitude: 51.5,
  longitude: -0.12,
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
};

const profile = { userId: 'u1', latitude: 52.0, longitude: -1.5 };

describe('TravelTimeService', () => {
  let service: TravelTimeService;
  let contactsRepo: MockContactsRepo;
  let userProfileRepo: MockUserProfileRepo;
  let distanceMatrix: MockDistanceMatrix;

  beforeEach(() => {
    contactsRepo = makeContactsRepo();
    userProfileRepo = makeUserProfileRepo();
    distanceMatrix = makeDistanceMatrix();
    service = new TravelTimeService(
      contactsRepo as unknown as ContactsRepository,
      userProfileRepo as unknown as UserProfileRepository,
      distanceMatrix as unknown as DistanceMatrixClient,
    );
  });

  describe('getTravelTime', () => {
    it('throws 422 when contact primaryRole is not VENUE', async () => {
      contactsRepo.findOne.mockResolvedValue({ ...venueContact, primaryRole: 'CUSTOMER' });
      await expect(service.getTravelTime('u1', 'c1')).rejects.toThrow(
        new UnprocessableEntityException('Travel time is only available for venue contacts'),
      );
    });

    it('returns cached values without calling Distance Matrix when travelTimeCalculatedAt is set', async () => {
      const calculatedAt = new Date('2026-06-01T10:00:00.000Z');
      contactsRepo.findOne.mockResolvedValue({
        ...venueContact,
        travelTimeMinutes: 45,
        travelDistanceMetres: 62000,
        travelTimeCalculatedAt: calculatedAt,
        travelMode: 'DRIVING',
      });
      const result = await service.getTravelTime('u1', 'c1');
      expect(distanceMatrix.getDistance).not.toHaveBeenCalled();
      expect(result).toEqual({
        minutes: 45,
        distanceMetres: 62000,
        calculatedAt: '2026-06-01T10:00:00.000Z',
      });
    });

    it('throws 422 with venue address message when contact has no coordinates', async () => {
      contactsRepo.findOne.mockResolvedValue({
        ...venueContact,
        latitude: null,
        longitude: null,
      });
      await expect(service.getTravelTime('u1', 'c1')).rejects.toThrow(
        new UnprocessableEntityException('Venue address not set'),
      );
    });

    it('throws 422 with home address message when UserProfile has no coordinates', async () => {
      contactsRepo.findOne.mockResolvedValue(venueContact);
      userProfileRepo.upsertByUserId.mockResolvedValue({
        ...profile,
        latitude: null,
        longitude: null,
      });
      await expect(service.getTravelTime('u1', 'c1')).rejects.toThrow(
        new UnprocessableEntityException(
          'Home address not set — add it in Settings to see travel time',
        ),
      );
    });

    it('calls Distance Matrix, stores result, and returns travel time when both addresses are present', async () => {
      contactsRepo.findOne.mockResolvedValue(venueContact);
      userProfileRepo.upsertByUserId.mockResolvedValue(profile);
      distanceMatrix.getDistance.mockResolvedValue({ minutes: 90, distanceMetres: 130000 });
      contactsRepo.updateTravelTime.mockResolvedValue(undefined);

      const result = await service.getTravelTime('u1', 'c1');

      expect(distanceMatrix.getDistance).toHaveBeenCalledWith(
        { lat: profile.latitude, lng: profile.longitude },
        { lat: venueContact.latitude, lng: venueContact.longitude },
      );
      expect(contactsRepo.updateTravelTime).toHaveBeenCalledWith('c1', {
        travelTimeMinutes: 90,
        travelDistanceMetres: 130000,
        travelTimeCalculatedAt: expect.any(Date),
        travelMode: 'DRIVING',
      });
      expect(result).toEqual({
        minutes: 90,
        distanceMetres: 130000,
        calculatedAt: expect.any(String),
      });
    });
  });

  describe('clearAllForUser', () => {
    it('delegates to contacts repository', async () => {
      contactsRepo.clearTravelTimeForUser.mockResolvedValue(undefined);
      await service.clearAllForUser('u1');
      expect(contactsRepo.clearTravelTimeForUser).toHaveBeenCalledWith('u1');
    });
  });
});
