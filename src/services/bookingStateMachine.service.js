'use strict';

const AppError = require('../utils/appError');

// The booking lifecycle. Every action names the states it may be applied
// from; anything else is rejected with 409 CONFLICT rather than silently
// mutating a booking into an inconsistent state.
//
//   REQUESTED --assign--> ASSIGNED --accept--> ACCEPTED --onTheWay--> ON_THE_WAY
//                  ^          |                                          |
//                  |        reject                                    arrive
//                  |          v                                          v
//                  |      REJECTED                                   ARRIVED
//                  |                                                     |
//              reschedule                                              start
//                  |                                                     v
//                  +---------------------------------------------- IN_PROGRESS
//                                                                        |
//                                                                     complete
//                                                                        v
//                                                                   COMPLETED
//
// cancel is allowed from REQUESTED / ASSIGNED / ACCEPTED / ON_THE_WAY.
const ALLOWED_FROM = {
  assign: ['REQUESTED', 'REJECTED', 'RESCHEDULED'],
  accept: ['ASSIGNED'],
  reject: ['ASSIGNED'],
  onTheWay: ['ACCEPTED'],
  arrive: ['ON_THE_WAY'],
  start: ['ARRIVED'],
  complete: ['IN_PROGRESS'],
  cancel: ['REQUESTED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'],
  reschedule: ['REQUESTED', 'ASSIGNED', 'ACCEPTED'],
};

const TARGET_STATUS = {
  assign: 'ASSIGNED',
  accept: 'ACCEPTED',
  reject: 'REJECTED',
  onTheWay: 'ON_THE_WAY',
  arrive: 'ARRIVED',
  start: 'IN_PROGRESS',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  reschedule: 'RESCHEDULED',
};

function assertTransition(booking, action) {
  const allowedFrom = ALLOWED_FROM[action];
  if (!allowedFrom || !allowedFrom.includes(booking.status)) {
    throw AppError.conflict(`Cannot ${action} a booking currently in status ${booking.status}`);
  }
  return TARGET_STATUS[action];
}

module.exports = { ALLOWED_FROM, TARGET_STATUS, assertTransition };
