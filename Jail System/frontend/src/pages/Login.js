import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        login();
        alert('Successfully Signed In');
        navigate('/'); // Redirect to dashboard
      } else {
        const data = await response.json();
        alert(data.message || 'Login failed');
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      alert('Login failed: ' + err.message);
      setError('Login failed: ' + err.message);
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        alert('Successfully Created');
        setIsLogin(true);
        resetForm();
      } else {
        const data = await response.json();
        alert(data.message || 'Sign up failed');
        setError(data.message || 'Sign up failed');
      }
    } catch (err) {
      alert('Sign up failed: ' + err.message);
      setError('Sign up failed: ' + err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="login-logos">
          <img src="/logo1.png" alt="Logo 1" />
          <img src="/logo2.png" alt="Logo 2" />
          <img src="/logo3.png" alt="Logo 3" />
        </div>
        <h1 className="login-title">SILANG MUNICIPAL JAIL VISITATION MANAGEMENT SYSTEM</h1>
      </div>
      {isLogin ? (
        <form className="login-form" onSubmit={handleLoginSubmit}>
          <label>
            <div className="login-text">Login</div>
            Username:
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <div className="login-buttons">
            <button type="submit">Login</button>
            <button type="button" onClick={() => { setIsLogin(false); resetForm(); }}>Sign Up</button>
          </div>
        </form>
      ) : (
        <form className="login-form" onSubmit={handleSignUpSubmit}>
          <label>
            <div className="login-text">Sign Up</div>
            Username:
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Confirm Password:
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="login-error">{error}</div>}
          <div className="login-buttons">
            <button type="submit">Sign Up</button>
            <button type="button" onClick={() => { setIsLogin(true); resetForm(); }}>Back to Login</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Login;
