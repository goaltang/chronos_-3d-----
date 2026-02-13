
import { PhotoData } from './types';

export const PHOTO_COUNT = 30;
export const TUNNEL_DEPTH = 150;
export const SPIRAL_RADIUS = 8;

export const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export const MOCK_PHOTOS: PhotoData[] = Array.from({ length: PHOTO_COUNT }, (_, i) => {
  const date = new Date();
  date.setMonth(date.getMonth() - i); // 每张图代表过去的一个月
  
  return {
    id: i,
    url: `https://picsum.photos/seed/${i + 123}/800/1000`,
    title: `记忆片段 #${i + 1}`,
    year: date.getFullYear().toString(),
    month: MONTH_NAMES[date.getMonth()],
    timestamp: date.getTime(),
    description: "在这个时间点，某些重要的事情发生了，被永久记录在此时空中。"
  };
});
