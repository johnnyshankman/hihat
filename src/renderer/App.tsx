import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { IAudioMetadata } from 'music-metadata';
import placeholder from '../../assets/placeholder.svg';
import './App.css';
import { useState } from 'react';

function MainDash() {
  const [songMapping, setSongMapping] = useState<{
    [key: string]: IAudioMetadata;
  }>();

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-center p-4 space-x-4 md:flex-row">
        <img
          src={placeholder}
          height="200"
          width="200"
          alt="Album Art"
          className="object-cover rounded-lg shadow-md"
          style={{
            aspectRatio: '200/200',
            objectFit: 'cover',
          }}
        />
      </div>

      <div className="w-full overflow-auto">
        <table className="w-full max-h-full caption-bottom text-sm p-1 overflow-auto">
          <thead className="sticky top-0 bg-white outline outline-offset-0 outline-1 outline-slate-100">
            <tr className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted divide-x divide-slate-50">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0 text-xs">
                Song
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0 text-xs">
                Artist
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0 text-xs">
                Album
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0 text-xs">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="[&amp;_tr:last-child]:border-0 ">
            {Object.keys(songMapping || {}).map((song) => (
              <tr
                key={song}
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted py-1 divide-x divide-slate-50"
              >
                <td className="py-1.5 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-xs">
                  {songMapping?.[song].common.title}
                </td>
                <td className="py-1.5 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-xs">
                  {songMapping?.[song].common.artist}
                </td>
                <td className="py-1.5 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-xs">
                  {songMapping?.[song].common.album}
                </td>
                <td className="py-1.5 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-xs">
                  {songMapping?.[song].format.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fixed inset-x-0 border-t bottom-0 bg-white shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            aria-label="previous"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className=" w-4 h-4"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </button>

          <button
            onClick={async () => {
              window.electron.ipcRenderer.once('select-dirs', (arg) => {
                // eslint-disable-next-line no-console
                console.log('finished', arg);
                setSongMapping(arg);
              });
              window.electron.ipcRenderer.sendMessage('select-dirs');
            }}
            type="button"
            aria-label="play"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className=" w-4 h-4"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="next"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className=" w-4 h-4"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="w-1/3 h-1 bg-gray-200 rounded-full relative">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{
              // @dev: controls the progress bar inner filling
              width: '25%',
            }}
          />
          <p className="text-xs text-center absolute w-full bottom-full mb-1">
            1:15
          </p>
        </div>
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className=" w-4 h-4"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          </svg>
          <div className="w-16 h-1 mx-2 bg-gray-200 rounded-full">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{
                // @dev: controls the volume bar inner filling
                width: '75%',
              }}
            />
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className=" w-4 h-4"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainDash />} />
      </Routes>
    </Router>
  );
}
