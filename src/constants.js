import { makeKeySet } from './util';

export const MAX_HEADER_DEPTH = 6;
export const OFFSET_INVALID = -1;
export const SEPARATOR_DASH_LENGTH = 3;
export const TAB_WIDTH = 4;

/** convenience dictionary of some commonly used keycodes */
export const keys = {
  HASH: '#'.charCodeAt(0),
  BACKTICK: '`'.charCodeAt(0),
  ASTERISK: '*'.charCodeAt(0),
  UNDERSCORE: '_'.charCodeAt(0),
  SPACE: ' '.charCodeAt(0),

  ENTER: '\r'.charCodeAt(0),
  BACKSPACE: '\b'.charCodeAt(0),
  DELETE: 46,
  TAB: '\t'.charCodeAt(0),
};

/** list of keycodes for all ascii characters during a keypress event */
export const asciiKeys = makeKeySet(
	' !"#$%&\'()*+,-./0123456789:;<=>?@' +
	'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`' +
	'abcdefghijklmnopqrstuvwxyz{|}~');
