'use client';

import { useState } from 'react';
import dayjs from 'dayjs';

interface BookingItemProps {
  booking: any;
  token: string;
  onUpdate: () => void;
}

export default function BookingItem({ booking, token, onUpdate }: BookingItemProps) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(booking.notes || '');
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleUpdateNotes = async () => {
    setUpdating(true);
    try {
      const response = await fetch('/api/bookings/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          notes: editedNotes,
        }),
      });

      if (response.ok) {
        setEditingNotes(false);
        onUpdate(); // Refresh bookings
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to update notes');
      }
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('Failed to update notes');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelClick = () => {
    setShowCancelConfirm(true);
  };

  const handleCancelConfirm = async () => {
    setCancelling(true);
    try {
      const response = await fetch('/api/bookings/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          action: 'cancel',
        }),
      });

      if (response.ok) {
        onUpdate(); // Refresh bookings
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {dayjs(booking.date).format('dddd, MMMM D, YYYY')} at {booking.time}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Method: {booking.preferredMethod === 'teams' ? 'Microsoft Teams' : booking.preferredMethod === 'google-meet' ? 'Google Meet' : 'Phone call'}
          </p>
          {booking.preferredMethod !== 'phone' && (
            <>
              <p className="text-sm text-gray-600">
                Share screen: {booking.shareScreen ? 'Yes' : 'No'} | Record: {booking.recordConversation ? 'Yes' : 'No'}
              </p>
            </>
          )}
          {!editingNotes ? (
            <div className="mt-2">
              {booking.notes ? (
                <p className="text-sm text-gray-600">
                  Notes: {booking.notes}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">No notes</p>
              )}
              {booking.status !== 'cancelled' && (
                <button
                  onClick={() => {
                    setEditedNotes(booking.notes || '');
                    setEditingNotes(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                >
                  Edit notes
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <textarea
                value={editedNotes}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const words = newValue.trim().split(/\s+/).filter(Boolean);
                  if (words.length <= 200) {
                    setEditedNotes(newValue);
                  }
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="Add notes..."
              />
              {editedNotes.trim().split(/\s+/).filter(Boolean).length >= 200 && (
                <p className="text-xs text-red-600 mt-1">Maximum 200 words reached</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleUpdateNotes}
                  disabled={updating}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setEditedNotes(booking.notes || '');
                  }}
                  className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 ml-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
            booking.status === 'requested' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {booking.status === 'requested' ? 'Requested' : booking.status}
          </span>
          {booking.status !== 'cancelled' && (
            <div className="flex flex-col gap-1">
              {!showCancelConfirm ? (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-600 mb-1">Cancel this meeting?</p>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        setCancelling(true);
                        try {
                          const response = await fetch('/api/bookings/update', {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                              'Origin': window.location.origin,
                            },
                            body: JSON.stringify({
                              bookingId: booking.id,
                              action: 'cancel',
                            }),
                          });

                          if (response.ok) {
                            onUpdate(); // Refresh bookings
                          } else {
                            const errorData = await response.json().catch(() => ({}));
                            alert(errorData.error || 'Failed to cancel booking');
                            setShowCancelConfirm(false);
                          }
                        } catch (error) {
                          console.error('Error cancelling booking:', error);
                          alert('Failed to cancel booking');
                          setShowCancelConfirm(false);
                        } finally {
                          setCancelling(false);
                        }
                      }}
                      disabled={cancelling}
                      className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

