import useMainStore from '../store/main';

export default function AlphabetSlider() {
  const storeLibrary = useMainStore((state) => state.library);
  const setInitialScrollIndex = useMainStore(
    (state) => state.setInitialScrollIndex,
  );

  const handleClick = (letter: string) => {
    // find a song that starts with that letter in the title
    const index = Object.keys(storeLibrary).findIndex(
      (key) => storeLibrary[key].common.artist?.startsWith(letter),
    );

    setInitialScrollIndex(index);
  };

  return (
    <div className="alphabet absolute z-[10000] right-0 opacity-100 h-full w-6 flex-col flex bg-black justify-between">
      {['A', 'F', 'I', 'O', 'Q', 'U', 'Z'].map((letter: string) => (
        <button
          className="w-[24px] bg-black hover:bg-gray-800 flex items-center justify-center no-underline border-0 opacity-100"
          key={letter}
          type="button"
          onClick={() => {
            handleClick(letter);
          }}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}
