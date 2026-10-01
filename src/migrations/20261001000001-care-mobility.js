'use strict';

// Care Mobility: home visits made dispatchable, and transport to care.
//
// The home-visit side does NOT get a new table. `bookings` already is a
// care request — client, patient, service, assigned staff, location,
// schedule, a server-enforced state machine — and a parallel
// `care_requests` table would split one booking across two places and
// leave every report wondering which one to count. So bookings gain the
// columns dispatch was missing, and everything else here is genuinely
// new:
//
//   transport_requests   taking someone to a facility — not a visit
//   status_history       every transition, for both, with who did it
//   saved_locations      a client's own addresses
//   service_zones        where the business operates, as data
//   app_settings         operational rules an admin can change
//
// Dar es Salaam appears below only as a seed row in service_zones.
// Nothing in the code knows the name of a city, so a second region is
// an INSERT, not a release.
module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = queryInterface;

    // --- Booking states ---------------------------------------------------
    //
    // ADD VALUE cannot run inside a transaction on every Postgres this
    // may meet, so these go first and alone.
    //
    //   UNDER_REVIEW  a dispatcher has picked it up — so the client sees
    //                 that a person is looking, not just "requested"
    //   FAILED        it was meant to happen and did not (no-show, the
    //                 nurse fell ill on the way) — distinct from a
    //                 cancellation, which somebody chose
    //   EXPIRED       nobody was assigned before the time passed
    for (const value of ['UNDER_REVIEW', 'FAILED', 'EXPIRED']) {
      await sequelize.query(`ALTER TYPE "enum_bookings_status" ADD VALUE IF NOT EXISTS '${value}';`);
    }

    // --- bookings: what dispatch needs ------------------------------------
    await queryInterface.addColumn('bookings', 'booking_reference', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
    // Backfill before the unique index, so existing rows have one too.
    // md5 of the id is stable and unique enough at this scale; the
    // service generates fresh ones with a collision retry.
    await sequelize.query(
      `UPDATE bookings SET booking_reference = 'AN-' || upper(substr(md5(id::text), 1, 6))
       WHERE booking_reference IS NULL;`
    );
    await queryInterface.changeColumn('bookings', 'booking_reference', {
      type: Sequelize.STRING(16),
      allowNull: false,
    });
    await queryInterface.addIndex('bookings', ['booking_reference'], { unique: true });

    // The same request sent twice — a double tap, a retry after a
    // timeout on a slow connection — must create one booking, not two.
    await queryInterface.addColumn('bookings', 'idempotency_key', {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await queryInterface.addIndex('bookings', ['client_profile_id', 'idempotency_key'], {
      unique: true,
      where: { idempotency_key: { [Sequelize.Op.ne]: null } },
      name: 'bookings_client_idempotency_unique',
    });

    // House, floor, landmark, how to get in. Free text in one address
    // line is how a nurse ends up phoning from the wrong gate.
    await queryInterface.addColumn('bookings', 'location_details', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'accessibility_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'time_window', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
    // Who pressed the button, which is not always the patient and not
    // always the account holder — family coordination needs both.
    await queryInterface.addColumn('bookings', 'created_by_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('bookings', 'quoted_price_tzs', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('bookings', 'confirmed_price_tzs', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    // staff_id is indexed already; the dispatcher's conflict check and
    // the expiry sweep both range over scheduled_at.
    await queryInterface.addIndex('bookings', ['scheduled_at']);

    // --- service_zones ------------------------------------------------------
    await queryInterface.createTable('service_zones', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      region: { type: Sequelize.STRING, allowNull: false },
      // A centre and a radius. Polygons would be more exact and need
      // PostGIS; a circle is honest about being approximate, and is
      // replaced without touching anything that reads it.
      center_lat: { type: Sequelize.FLOAT, allowNull: false },
      center_lng: { type: Sequelize.FLOAT, allowNull: false },
      radius_km: { type: Sequelize.FLOAT, allowNull: false },
      home_visits: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      transport: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    const now = new Date();
    await queryInterface.bulkInsert('service_zones', [
      {
        name: 'Dar es Salaam',
        region: 'Dar es Salaam',
        center_lat: -6.7924,
        center_lng: 39.2083,
        radius_km: 35,
        home_visits: true,
        // A transport request is a request, not a promise: a dispatcher
        // reviews it, quotes it and finds the vehicle, by hand until a
        // partner company is wired in. Switching it off for a zone is
        // an admin setting, not a deploy.
        transport: true,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);

    await queryInterface.addColumn('bookings', 'service_zone_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'service_zones', key: 'id' },
      onDelete: 'SET NULL',
    });

    // --- saved_locations ----------------------------------------------------
    await queryInterface.createTable('saved_locations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      client_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      label: { type: Sequelize.STRING(60), allowNull: false },
      address: { type: Sequelize.TEXT, allowNull: false },
      lat: { type: Sequelize.FLOAT, allowNull: true },
      lng: { type: Sequelize.FLOAT, allowNull: true },
      details: { type: Sequelize.JSONB, allowNull: true },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('saved_locations', ['client_profile_id']);

    // --- transport_requests -------------------------------------------------
    await queryInterface.createTable('transport_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      booking_reference: { type: Sequelize.STRING(16), allowNull: false, unique: true },
      client_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'client_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      family_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'family_members', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      service_zone_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'service_zones', key: 'id' },
        onDelete: 'SET NULL',
      },

      pickup_address: { type: Sequelize.TEXT, allowNull: false },
      pickup_lat: { type: Sequelize.FLOAT, allowNull: true },
      pickup_lng: { type: Sequelize.FLOAT, allowNull: true },
      pickup_details: { type: Sequelize.JSONB, allowNull: true },

      destination_type: {
        type: Sequelize.ENUM('HOSPITAL', 'CLINIC', 'FACILITY', 'PHARMACY', 'OTHER'),
        allowNull: false,
      },
      destination_name: { type: Sequelize.STRING, allowNull: false },
      destination_address: { type: Sequelize.TEXT, allowNull: true },
      destination_lat: { type: Sequelize.FLOAT, allowNull: true },
      destination_lng: { type: Sequelize.FLOAT, allowNull: true },

      passenger_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      scheduled_at: { type: Sequelize.DATE, allowNull: false },
      mobility_needs: { type: Sequelize.TEXT, allowNull: true },
      companion_name: { type: Sequelize.STRING, allowNull: true },
      contact_phone: { type: Sequelize.STRING(20), allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },

      status: {
        type: Sequelize.ENUM(
          'REQUESTED',
          'UNDER_REVIEW',
          'QUOTED',
          'ACCEPTED',
          'ASSIGNED',
          'EN_ROUTE',
          'ARRIVED_PICKUP',
          'IN_TRIP',
          'ARRIVED_DESTINATION',
          'COMPLETED',
          'CANCELLED',
          'REJECTED',
          'FAILED',
          'EXPIRED'
        ),
        allowNull: false,
        defaultValue: 'REQUESTED',
      },

      quoted_fare_tzs: { type: Sequelize.INTEGER, allowNull: true },
      confirmed_fare_tzs: { type: Sequelize.INTEGER, allowNull: true },
      quote_note: { type: Sequelize.TEXT, allowNull: true },

      // Who drives. Either one of our own staff, or a partner company —
      // in which case these are filled from the partner adapter when
      // one is configured, and by the dispatcher by hand until then.
      assigned_staff_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'staff_profiles', key: 'id' },
        onDelete: 'SET NULL',
      },
      partner_name: { type: Sequelize.STRING, allowNull: true },
      partner_reference: { type: Sequelize.STRING, allowNull: true },
      driver_name: { type: Sequelize.STRING, allowNull: true },
      // Kept for the dispatcher. Never sent to the client — the client
      // reaches the trip through Afya Nyumbani, the same rule that keeps
      // a nurse's own number off the client's screen.
      driver_phone: { type: Sequelize.STRING(20), allowNull: true },
      vehicle_details: { type: Sequelize.STRING, allowNull: true },

      cancellation_reason: { type: Sequelize.TEXT, allowNull: true },
      idempotency_key: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('transport_requests', ['client_profile_id']);
    await queryInterface.addIndex('transport_requests', ['status']);
    await queryInterface.addIndex('transport_requests', ['scheduled_at']);
    await queryInterface.addIndex('transport_requests', ['assigned_staff_id']);
    await queryInterface.addIndex('transport_requests', ['client_profile_id', 'idempotency_key'], {
      unique: true,
      where: { idempotency_key: { [Sequelize.Op.ne]: null } },
      name: 'transport_client_idempotency_unique',
    });

    // --- status_history -----------------------------------------------------
    //
    // One table for both kinds of request. The tracking screen draws its
    // timeline from here, and an argument about "when did the nurse
    // actually leave" is settled by a row, not by memory.
    await queryInterface.createTable('status_history', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      entity_type: { type: Sequelize.ENUM('BOOKING', 'TRANSPORT'), allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      from_status: { type: Sequelize.STRING(32), allowNull: true },
      to_status: { type: Sequelize.STRING(32), allowNull: false },
      actor_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('status_history', ['entity_type', 'entity_id', 'created_at']);

    // --- app_settings -------------------------------------------------------
    await queryInterface.createTable('app_settings', {
      key: { type: Sequelize.STRING(80), primaryKey: true },
      value: { type: Sequelize.JSONB, allowNull: false },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // --- staff: availability beyond a single switch ------------------------
    await queryInterface.addColumn('staff_profiles', 'working_hours', {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await queryInterface.addColumn('staff_profiles', 'unavailable_until', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    // Where they usually start from, for a distance in the dispatcher's
    // shortlist. Optional, and never shown to a client.
    await queryInterface.addColumn('staff_profiles', 'base_lat', { type: Sequelize.FLOAT, allowNull: true });
    await queryInterface.addColumn('staff_profiles', 'base_lng', { type: Sequelize.FLOAT, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staff_profiles', 'base_lng');
    await queryInterface.removeColumn('staff_profiles', 'base_lat');
    await queryInterface.removeColumn('staff_profiles', 'unavailable_until');
    await queryInterface.removeColumn('staff_profiles', 'working_hours');
    await queryInterface.dropTable('app_settings');
    await queryInterface.dropTable('status_history');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_status_history_entity_type";');
    await queryInterface.dropTable('transport_requests');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transport_requests_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transport_requests_destination_type";');
    await queryInterface.dropTable('saved_locations');
    await queryInterface.removeColumn('bookings', 'service_zone_id');
    await queryInterface.dropTable('service_zones');
    for (const col of [
      'confirmed_price_tzs',
      'quoted_price_tzs',
      'created_by_user_id',
      'time_window',
      'accessibility_notes',
      'location_details',
      'idempotency_key',
      'booking_reference',
    ]) {
      await queryInterface.removeColumn('bookings', col);
    }
    // Enum values added to enum_bookings_status are left in place:
    // Postgres cannot drop a value from an enum, and no row will use
    // them once this is rolled back.
  },
};
