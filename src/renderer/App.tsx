import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Main from './components/Main';
import './App.scss';
/**
 * @dev forces all google material ui components to use the dark theme
 */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div className="shell">
              {/**
               * @dev themeprovider and cssbaseline are used to render
               * all google material ui components in dark mode
               */}
              <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <Main />
              </ThemeProvider>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
