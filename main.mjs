import YangService from "./dist/index.js";
export default YangService;
export const {
  YangError,
  YangAuthError,
  YangNotFoundError,
  YangConnectionError,
  YangRequestError,
} = YangService;
