import { BrowserRouter } from 'react-router-dom';
import AppRouter from './components/Router';

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;