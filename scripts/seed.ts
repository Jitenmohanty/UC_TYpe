import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../src/config/env';
import { UserModel } from '../src/modules/users/user.model';
import { BarberProfileModel } from '../src/modules/barbers/barberProfile.model';
import { ServiceModel } from '../src/modules/services/service.model';
import { BarberServiceModel } from '../src/modules/barberServices/barberService.model';
import { UserRole, UserStatus, BarberStatus, ServiceStatus } from '../src/common/constants/roles';
import { logger } from '../src/common/utils/logger';

// ─── Bhubaneswar, India test coordinates ─────────────────────────────────────
// Customer at: 20.2961, 85.8245 (Bhubaneswar center)
const CUSTOMER_LAT = 20.2961;
const CUSTOMER_LON = 85.8245;

const BARBERS = [
  { name: 'Amit Kumar',    lat: 20.3069, lon: 85.8245, distDesc: '~1.2 KM', rating: 4.4 },
  { name: 'Ravi Sharma',   lat: 20.3161, lon: 85.8400, distDesc: '~2.7 KM', rating: 4.9 },
  { name: 'Suresh Panda',  lat: 20.3320, lon: 85.8500, distDesc: '~4.3 KM', rating: 4.7 },
  { name: 'Deepak Nayak',  lat: 20.3700, lon: 85.8600, distDesc: '~7.5 KM', rating: 5.0 },
];

async function seed(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info({ msg: '🌱 Connected to MongoDB for seeding' });

  // Clear existing
  await Promise.all([
    UserModel.deleteMany({}),
    BarberProfileModel.deleteMany({}),
    ServiceModel.deleteMany({}),
    BarberServiceModel.deleteMany({}),
  ]);

  // ─── Create Admin ───────────────────────────────────────────────────────────
  const adminUser = await UserModel.create({
    name: 'Super Admin',
    email: 'admin@salonbooking.com',
    phone: '+911234567890',
    passwordHash: await bcrypt.hash('Admin@123', 12),
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });
  logger.info({ msg: '✅ Admin created', email: adminUser.email });

  // ─── Create Customers ───────────────────────────────────────────────────────
  const customer1 = await UserModel.create({
    name: 'Priya Mishra',
    email: 'priya@example.com',
    phone: '+919876543210',
    passwordHash: await bcrypt.hash('Customer@123', 12),
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    location: {
      type: 'Point',
      coordinates: [CUSTOMER_LON, CUSTOMER_LAT],
    },
    locationUpdatedAt: new Date(),
  });
  logger.info({ msg: '✅ Customer created', name: customer1.name });

  // ─── Create Services ────────────────────────────────────────────────────────
  const services = await ServiceModel.insertMany([
    {
      name: 'Executive Haircut & Styling',
      description: 'Custom precision haircut tailored to face structure, organic shampoo, scalp massage & hot towel styling finish.',
      price: 399,
      durationMinutes: 45,
      status: ServiceStatus.ACTIVE,
      categoryId: 'hair',
    },
    {
      name: 'Beard Sculpting & Hot Oil Spa',
      description: 'Razor edge lining, hot oil beard treatment, trimming, and luxury hydrating balm application.',
      price: 249,
      durationMinutes: 30,
      status: ServiceStatus.ACTIVE,
      categoryId: 'beard',
    },
    {
      name: 'Full Royal Deluxe Package',
      description: 'Executive haircut, beard sculpting, charcoal facial detox mask, eyebrow trimming & neck tension massage.',
      price: 699,
      durationMinutes: 75,
      status: ServiceStatus.ACTIVE,
      categoryId: 'package',
    },
    {
      name: 'Haircut + Beard Glow Duo',
      description: 'Complete grooming combo including custom haircut, beard trim, razor cleanup & styling.',
      price: 499,
      durationMinutes: 60,
      status: ServiceStatus.ACTIVE,
      categoryId: 'package',
    },
    {
      name: 'Scalp Detox & Hair Spa Treatment',
      description: 'Deep root scalp cleansing, nourishing hair spa mask, warm steam infusion and head massage.',
      price: 599,
      durationMinutes: 50,
      status: ServiceStatus.ACTIVE,
      categoryId: 'spa',
    },
    {
      name: 'Classic Hot Towel Razor Shave',
      description: 'Traditional straight razor shave with essential oils, hot lather, cold compress, and soothing aftershave balm.',
      price: 199,
      durationMinutes: 25,
      status: ServiceStatus.ACTIVE,
      categoryId: 'beard',
    },
  ]);
  logger.info({ msg: `✅ ${services.length} luxury services created` });

  const haircutService = services[0]!;

  // ─── Create Barbers ─────────────────────────────────────────────────────────
  const defaultWorkingHours = {
    monday:    { enabled: true,  start: '09:00', end: '19:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '19:00' },
    wednesday: { enabled: true,  start: '09:00', end: '19:00' },
    thursday:  { enabled: true,  start: '09:00', end: '19:00' },
    friday:    { enabled: true,  start: '09:00', end: '19:00' },
    saturday:  { enabled: true,  start: '09:00', end: '18:00' },
    sunday:    { enabled: false, start: '10:00', end: '14:00' },
  };

  for (let i = 0; i < BARBERS.length; i++) {
    const b = BARBERS[i]!;
    const barberUser = await UserModel.create({
      name: b.name,
      email: `${b.name.toLowerCase().replace(' ', '.')}@salonbooking.com`,
      phone: `+9198765432${20 + i}`,
      passwordHash: await bcrypt.hash('Barber@123', 12),
      role: UserRole.BARBER,
      status: UserStatus.ACTIVE,
    });

    const profile = await BarberProfileModel.create({
      userId: barberUser._id,
      bio: `Professional barber with ${5 + i} years experience. Specializing in modern cuts.`,
      experienceYears: 5 + i,
      rating: b.rating,
      totalReviews: 20 + i * 10,
      totalCompletedJobs: 150 + i * 50,
      totalAccepted: 160 + i * 52,
      totalOffered: 165 + i * 53,
      autoAllocationEnabled: i < 3, // Barber D (outside radius) has auto-allocation disabled
      serviceRadiusKm: 5,
      currentLocation: {
        type: 'Point',
        coordinates: [b.lon, b.lat],
      },
      locationUpdatedAt: new Date(),
      workingHours: defaultWorkingHours,
      status: BarberStatus.ACTIVE,
    });

    // Add all services to first 3 barbers
    for (const service of services) {
      await BarberServiceModel.create({
        barberId: profile._id,
        serviceId: service._id,
        price: service.price,
        isActive: true,
      });
    }

    logger.info({
      msg: `✅ Barber created`,
      name: b.name,
      location: `${b.distDesc} from customer`,
      autoAlloc: i < 3,
    });
  }

  logger.info({ msg: '\n📍 Scenario Summary:', note: 'Customer at Bhubaneswar center' });
  logger.info({ msg: '  Barber A (Amit):  1.2 KM ✅ within 5km' });
  logger.info({ msg: '  Barber B (Ravi):  2.7 KM ✅ within 5km' });
  logger.info({ msg: '  Barber C (Suresh): 4.3 KM ✅ within 5km' });
  logger.info({ msg: '  Barber D (Deepak): 7.5 KM ❌ outside 5km' });

  logger.info({ msg: '\n🔑 Login credentials:' });
  logger.info({ msg: '  Admin:    admin@salonbooking.com / Admin@123' });
  logger.info({ msg: '  Customer: priya@example.com / Customer@123' });
  logger.info({ msg: '  Barber A: amit.kumar@salonbooking.com / Barber@123' });

  await mongoose.disconnect();
  logger.info({ msg: '✅ Seeding complete!' });
}

seed().catch((err) => {
  logger.error({ msg: 'Seed failed', error: err });
  process.exit(1);
});
