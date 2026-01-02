import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Mic2, LogOut, AlertCircle } from 'lucide-react';

export default function ProfileSetupPage() {
  const { user, idToken } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    callsign: '',
    realName: '',
    bio: '',
    avatarId: 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch existing profile if it exists
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/profile/me');
        if (response.data) {
          setFormData({
            callsign: response.data.callsign,
            realName: response.data.realName,
            bio: response.data.bio || '',
            avatarId: response.data.avatarId
          });
        }
      } catch (err) {
        // 404 is expected for new users
        if (err.response?.status !== 404) {
          console.error('Fetch profile error:', err);
        }
      }
    };

    if (idToken) {
      fetchProfile();
    }
  }, [idToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'avatarId' ? parseInt(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/profile', formData);
      // Profile saved successfully, navigate to main radio
      navigate('/radio');
    } catch (err) {
      console.error('Save profile error:', err);
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(user.auth || (await import('../firebase')).auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-military-900 via-military-800 to-military-700 flex items-center justify-center p-4">
      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-4 h-4 border-t-4 border-l-4 border-military-accent"></div>
      <div className="absolute top-4 right-4 w-4 h-4 border-t-4 border-r-4 border-military-accent"></div>
      <div className="absolute bottom-4 left-4 w-4 h-4 border-b-4 border-l-4 border-military-accent"></div>
      <div className="absolute bottom-4 right-4 w-4 h-4 border-b-4 border-r-4 border-military-accent"></div>

      <div className="w-full max-w-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Mic2 className="w-8 h-8 text-military-accent" />
            <h1 className="text-4xl font-black text-military-accent uppercase tracking-wider">TACTICAL PROFILE</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-military-danger hover:bg-red-600 text-white px-4 py-2 transition duration-200 uppercase font-bold text-sm border-2 border-military-danger"
            style={{ boxShadow: '0 0 10px rgba(231, 76, 60, 0.3)' }}
          >
            <LogOut className="w-4 h-4" />
            EXIT
          </button>
        </div>

        {/* Profile Form */}
        <div className="bg-military-800 border-4 border-military-accent p-8 space-y-6"
             style={{ boxShadow: '0 0 30px rgba(46, 204, 113, 0.3)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-black text-military-accent mb-2 uppercase tracking-wider">Email (Google)</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 border-2 border-military-600 rounded-lg bg-military-700 text-military-300 cursor-not-allowed font-mono text-sm"
              />
              <p className="text-xs text-military-400 mt-1 font-mono">Connected to Google account (read-only)</p>
            </div>

            {/* Callsign */}
            <div>
              <label htmlFor="callsign" className="block text-sm font-black text-military-accent mb-2 uppercase tracking-wider">
                Callsign <span className="text-military-danger">*</span>
              </label>
              <input
                id="callsign"
                type="text"
                name="callsign"
                value={formData.callsign}
                onChange={handleChange}
                placeholder="e.g., ALPHA1, BRAVO2"
                className="w-full px-4 py-3 border-2 border-military-accent bg-military-700 text-military-accent placeholder-military-500 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-military-accent"
                required
              />
              <p className="text-xs text-military-400 mt-1 font-mono">Unique identifier (required, max 50 chars)</p>
            </div>

            {/* Real Name */}
            <div>
              <label htmlFor="realName" className="block text-sm font-black text-military-accent mb-2 uppercase tracking-wider">
                Real Name <span className="text-military-danger">*</span>
              </label>
              <input
                id="realName"
                type="text"
                name="realName"
                value={formData.realName}
                onChange={handleChange}
                placeholder="Your full name"
                className="w-full px-4 py-3 border-2 border-military-accent bg-military-700 text-military-accent placeholder-military-500 focus:outline-none focus:ring-2 focus:ring-military-accent"
                required
              />
              <p className="text-xs text-military-400 mt-1 font-mono">Required</p>
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-black text-military-accent mb-2 uppercase tracking-wider">
                Bio (Optional)
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Short bio or role..."
                maxLength={100}
                rows={3}
                className="w-full px-4 py-3 border-2 border-military-accent bg-military-700 text-military-accent placeholder-military-500 font-mono focus:outline-none focus:ring-2 focus:ring-military-accent"
              />
              <p className="text-xs text-military-400 mt-1 font-mono">Max 100 characters ({formData.bio.length}/100)</p>
            </div>

            {/* Avatar Picker */}
            <div>
              <label className="block text-sm font-black text-military-accent mb-4 uppercase tracking-wider">
                Avatar <span className="text-military-danger">*</span>
              </label>
              <div className="grid grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((id) => (
                  <div key={id} className="relative">
                    <input
                      type="radio"
                      id={`avatar-${id}`}
                      name="avatarId"
                      value={id}
                      checked={formData.avatarId === id}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <label
                      htmlFor={`avatar-${id}`}
                      className={`block cursor-pointer border-4 transition-all rounded-sm ${
                        formData.avatarId === id
                          ? 'border-military-accent ring-2 ring-military-accent'
                          : 'border-military-600 hover:border-military-accent'
                      }`}
                      style={formData.avatarId === id ? { boxShadow: '0 0 15px rgba(46, 204, 113, 0.5)' } : {}}
                    >
                      <img
                        src={`/avatars/${id}.png`}
                        alt={`Avatar ${id}`}
                        className="w-full h-auto bg-military-700"
                        onError={(e) => {
                          e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%232d3436' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='40' fill='%232ecc71' font-weight='bold'%3E${id}%3C/text%3E%3C/svg%3E`;
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-military-400 mt-2 font-mono">Select one of 11 avatars (required)</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-military-danger bg-opacity-30 border-2 border-military-danger px-4 py-3 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-military-danger shrink-0 mt-0.5" />
                <p className="text-military-danger font-mono text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-black uppercase py-3 px-4 transition duration-200 tracking-wider border-2 ${
                loading
                  ? 'bg-military-600 border-military-600 text-military-400 cursor-not-allowed'
                  : 'bg-military-accent hover:bg-green-500 border-military-accent text-military-900'
              }`}
              style={!loading ? { boxShadow: '0 0 15px rgba(46, 204, 113, 0.4)' } : {}}
            >
              {loading ? '▰▰▰ SAVING ▰▰▰' : '▰▰▰ ENTER CHANNEL ▰▰▰'}
            </button>
          </form>
        </div>

        <p className="text-center text-military-accent text-sm mt-6 font-mono uppercase tracking-widest">
          ▰ ALL FIELDS REQUIRED ▰
        </p>
      </div>
    </div>
  );
}
