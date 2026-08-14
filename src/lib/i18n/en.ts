import { EN_COMMON } from "./en-common";
import { EN_MEMBER } from "./en-member";
import { EN_TRAINER } from "./en-trainer";
import { EN_TRAINER2 } from "./en-trainer2";

/** 한국어 원문 → 영어 번역 사전 (키는 화면에 쓰인 한국어 문자열) */
export const EN: Record<string, string> = {
  ...EN_COMMON,
  ...EN_MEMBER,
  ...EN_TRAINER,
  ...EN_TRAINER2,
};
