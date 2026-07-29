import moment from 'moment-jalaali';

export function toJalali(date, format = 'jYYYY/jMM/jDD') {
  if (!date) return '-';
  return moment(date).format(format);
}

export function toJalaliDateTime(date) {
  if (!date) return '-';
  return moment(date).format('jYYYY/jMM/jDD - HH:mm');
}

export function toJalaliFull(date) {
  if (!date) return '-';
  return moment(date).format('jYYYY/jMM/jDD - dddd - HH:mm');
}
