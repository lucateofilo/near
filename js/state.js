export const state = {
  user: null,       // oggetto user di Firebase Auth corrente
  coupleId: null,   // id del documento couples/{coupleId}, null finché non accoppiati
  partnerUid: null,
};

export function setUser(user) {
  state.user = user;
}

export function setCouple(coupleId, members) {
  state.coupleId = coupleId;
  state.partnerUid = members.find((uid) => uid !== state.user?.uid) || null;
}

export function reset() {
  state.user = null;
  state.coupleId = null;
  state.partnerUid = null;
}
