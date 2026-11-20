// Generates unique, clearly-fake fleet owner data for each run.
// Prefix "pwauto" makes automation records easy to find and clean up on staging.
export interface FleetOwnerData {
  username: string;
  password: string;
  contactName: string;
  mobile: string;
  email: string;
  businessName: string;
  city: string;
  state: string;
  pincode: string;
}

/** KYC / bank / IOCL details – format-valid but fake (sent only to the IOCL sandbox). */
export interface FleetOwnerKyc {
  pan: string;
  gstin: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  addressLine1: string;
  incorporationDate: { day: number; month: number; year: number }; // month 0-11
  panCardFile: string;
  aadhaarCardFile: string;
  customerFormFile: string;
}

export function newFleetOwnerKyc(): FleetOwnerKyc {
  // IOCL rejects a PAN it has seen before → random, not time-based
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  // PAN = 5 letters + 4 digits + 1 letter; 4th letter "C" = company
  const pan = `AAAC${letter()}${digits}${letter()}`;
  return {
    pan,
    gstin: `32${pan}1Z5`,                 // 32 = Kerala state code
    bankName: 'HDFC Bank',
    accountNumber: `50100${digits}123456`,
    ifsc: 'HDFC0000001',
    addressLine1: 'PW Auto Test Address, MG Road',
    incorporationDate: { day: 1, month: 0, year: 2020 },
    // Placeholder PDFs marked "AUTOMATION TEST DOCUMENT - NOT A REAL IDENTITY DOCUMENT"
    panCardFile: 'test-data/files/dummy-pan-card.pdf',
    aadhaarCardFile: 'test-data/files/dummy-aadhaar-card.pdf',
    customerFormFile: 'test-data/files/dummy-document.pdf',
  };
}

export function newFleetOwner(): FleetOwnerData {
  const id = Date.now().toString().slice(-7); // unique per run
  // Contact name allows only letters and spaces → map digits 0-9 to letters A-J
  const letters = id.replace(/\d/g, d => String.fromCharCode(65 + Number(d)));
  return {
    username: `pwauto_${id}`,
    password: `PwAuto@${id}x`,
    contactName: `PW Auto ${letters}`,
    mobile: `9${id.padStart(9, '0')}`,            // 10 digits, starts with 9
    email: `pwauto_${id}@example.com`,             // example.com never receives mail
    // Letters only: IOCL rejects customer / card names containing digits ("Invalid request")
    businessName: `PW Auto Logistics ${letters}`,
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682001',
  };
}
