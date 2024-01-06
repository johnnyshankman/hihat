export const bufferToDataUrl = async (
  buffer: Buffer,
  format: string,
): Promise<string> => {
  const blob = new Blob([buffer], { type: format });
  const reader = new FileReader();
  reader.readAsDataURL(blob);

  const res = (await new Promise((resolve) => {
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
  })) as string;

  return res;
};

/**
 * @dev self explanatory, converts to '00:00' format a la itunes
 */
export const convertToMMSS = (timeInSeconds: number) => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
};
