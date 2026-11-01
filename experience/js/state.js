// 인터랙션 상태 머신. 상태마다 허용되는 입력을 한 곳에서 정의해 충돌을 막는다.

export const S = Object.freeze({
  INITIAL: 'INITIAL',
  DOOR_HOVER: 'DOOR_HOVER',
  DOOR_OPENING: 'DOOR_OPENING',
  CAMERA_ENTERING: 'CAMERA_ENTERING',
  ROOM_EXPLORATION: 'ROOM_EXPLORATION',
  OBJECT_HOVER: 'OBJECT_HOVER',
  OBJECT_SELECTED: 'OBJECT_SELECTED',
  BOOK_OPENING: 'BOOK_OPENING',
  BOOK_READING: 'BOOK_READING',
  BOOK_CLOSING: 'BOOK_CLOSING',
  RETURN_TO_ROOM: 'RETURN_TO_ROOM',
  LEAVING: 'LEAVING',
});

// 입력 종류: doorHover, doorClick, look(마우스 시선), drag, objectHover, objectClick, page, reader, back
const ALLOW = {
  INITIAL:          ['doorHover', 'doorClick'],
  DOOR_HOVER:       ['doorHover', 'doorClick'],
  DOOR_OPENING:     [],
  CAMERA_ENTERING:  [],
  ROOM_EXPLORATION: ['look', 'drag', 'objectHover', 'objectClick'],
  OBJECT_HOVER:     ['look', 'drag', 'objectHover', 'objectClick'],
  OBJECT_SELECTED:  ['objectClick', 'back'],
  BOOK_OPENING:     [],
  BOOK_READING:     ['page', 'reader', 'back'],
  BOOK_CLOSING:     [],
  RETURN_TO_ROOM:   [],
  LEAVING:          [],
};

const NEXT = {
  INITIAL:          ['DOOR_HOVER', 'DOOR_OPENING'],
  DOOR_HOVER:       ['INITIAL', 'DOOR_OPENING'],
  DOOR_OPENING:     ['CAMERA_ENTERING'],
  CAMERA_ENTERING:  ['ROOM_EXPLORATION'],
  ROOM_EXPLORATION: ['OBJECT_HOVER', 'OBJECT_SELECTED', 'LEAVING'],
  OBJECT_HOVER:     ['ROOM_EXPLORATION', 'OBJECT_SELECTED', 'LEAVING'],
  OBJECT_SELECTED:  ['BOOK_OPENING', 'RETURN_TO_ROOM'],
  BOOK_OPENING:     ['BOOK_READING'],
  BOOK_READING:     ['BOOK_CLOSING', 'RETURN_TO_ROOM'],
  BOOK_CLOSING:     ['OBJECT_SELECTED', 'RETURN_TO_ROOM'],
  RETURN_TO_ROOM:   ['ROOM_EXPLORATION'],
  LEAVING:          [],
};

export function createState(onChange) {
  let cur = S.INITIAL;
  return {
    get: () => cur,
    is: (...names) => names.includes(cur),
    allows: (input) => ALLOW[cur].includes(input),
    set(next) {
      if (next === cur) return true;
      if (!NEXT[cur].includes(next)) {
        console.warn(`[state] blocked ${cur} → ${next}`);
        return false;
      }
      const prev = cur;
      cur = next;
      document.documentElement.dataset.state = cur;
      onChange?.(cur, prev);
      return true;
    },
  };
}
