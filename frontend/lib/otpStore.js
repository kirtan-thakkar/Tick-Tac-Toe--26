const globalStore = globalThis.otpStore || new Map();
if (process.env.NODE_ENV !== "production") globalThis.otpStore = globalStore;

export const setOTP = (email, code) => {
  globalStore.set(email, { code, expires: Date.now() + 5 * 60 * 1000 }); 
};

export const verifyOTP = (email, code) => {
  const record = globalStore.get(email);
  if (!record) return false;
  
  if (Date.now() > record.expires) {
    globalStore.delete(email);
    return false;
  }
  
  if (record.code === code) {
    globalStore.delete(email); 
    return true;
  }
  return false;
};