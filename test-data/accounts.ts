// Unique, clearly-fake data for Vehicles, Staff and Dealers. Prefix "pwauto" / "PW Auto"
// makes automation records easy to find and clean up on staging.

const uid = () => Date.now().toString().slice(-7);
/** Digits → letters (0→A … 9→J) for fields that accept letters only. */
const asLetters = (s: string) => s.replace(/\d/g, d => String.fromCharCode(65 + Number(d)));
const randomLetters = (n: number) =>
  Array.from({ length: n }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

export interface AccountData {
  username: string;
  fullName: string;
  email: string;
  password: string;
}

// Mobile number is optional on Staff/Dealer forms and is deliberately left empty,
// so no SMS/WhatsApp can reach a real person's number.
export function newStaff(): AccountData {
  const id = uid();
  return {
    username: `pwauto_staff_${id}`,
    fullName: `PW Auto Staff ${asLetters(id)}`,
    email: `pwauto_staff_${id}@example.com`,
    password: `PwAuto@${id}x`,
  };
}

export function newDealer(): AccountData {
  const id = uid();
  return {
    username: `pwauto_dealer_${id}`,
    fullName: `PW Auto Dealer ${asLetters(id)}`,
    email: `pwauto_dealer_${id}@example.com`,
    password: `PwAuto@${id}x`,
  };
}

export interface VehicleData {
  fleetOwnerSearch: string;   // text typed in the "Select Fleet Owner" box
  registrationNumber: string; // Indian format e.g. KL07PQ1234
  make?: string;              // text typed in the Make dropdown (default: first make in the list)
}

/** Vehicle added by a fleet owner from their own portal (no owner selection needed). */
export function newPortalVehicle(): VehicleData {
  return {
    fleetOwnerSearch: '',
    registrationNumber: `KL07${randomLetters(2)}${uid().slice(-4)}`,
    make: 'TATA MOTORS LTD', // the first make in the list has no models on staging
  };
}

export interface DriverData {
  firstName: string;
  lastName: string;
  mobile: string;
  city: string;
  state: string;
}

// Mobile number is REQUIRED on the driver form. 9000xxxxxx numbers are used so the
// test numbers are easy to spot; they could still belong to a real person.
export function newPortalDriver(): DriverData {
  const id = uid();
  return {
    firstName: 'PWAuto',
    lastName: `Driver ${asLetters(id)}`,
    mobile: `9000${id.slice(-6)}`,
    city: 'Kochi',
    state: 'Kerala',
  };
}

export function newVehicle(): VehicleData {
  const id = uid();
  return {
    fleetOwnerSearch: 'PW Auto Logistics', // attach to an automation-created fleet owner
    registrationNumber: `KL07${randomLetters(2)}${id.slice(-4)}`,
  };
}
