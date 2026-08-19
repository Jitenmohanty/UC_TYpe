import React from 'react';
import { ShieldCheck, Users, Calendar, IndianRupee, Activity, Zap, Sliders } from 'lucide-react';
import type { User } from '../types';

interface AdminDashboardProps {
  user: User | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  return (
    <div className="py-12 max-w-7xl mx-auto px-4 md:px-8 space-y-8 animate-fade-in">
      
      {/* Header Banner */}
      <div className="glass-card p-6 rounded-3xl border-amber-500/30 bg-amber-950/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-gold flex items-center justify-center text-black font-extrabold text-2xl shadow-xl shadow-amber-500/20">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-extrabold font-outfit text-white">System Administrator Portal</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Root Admin (`{user?.email || 'admin@salonbooking.com'}`)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Platform Operations, Bookings & Partner Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-obsidian-800 border border-green-500/30 text-green-400 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
            Booking System Online
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">₹1,48,900</div>
          <span className="text-[10px] text-green-400 font-medium">+18.4% from last month</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Active Barbers</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">42 Verified</div>
          <span className="text-[10px] text-purple-300 font-medium">3 Active in 5km radius</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Completed Jobs</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">1,280</div>
          <span className="text-[10px] text-blue-300 font-medium">98.2% Completion Rate</span>
        </div>

        <div className="glass-card p-6 rounded-3xl border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Avg Response Speed</span>
            <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-outfit text-white">42.5 sec</div>
          <span className="text-[10px] text-green-400 font-medium">Fast Partner Dispatch</span>
        </div>
      </div>

      {/* System Barbers Overview */}
      <div className="glass-card p-6 rounded-3xl border-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold font-outfit text-white">Barber Partner Network Status</h3>
          </div>
          <span className="text-xs text-gray-400">4 Active Barbers Seeded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-obsidian-800/80 uppercase tracking-wider text-[10px] text-gray-400">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Barber Name</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Auto-Allocation</th>
                <th className="px-4 py-3">Service Radius</th>
                <th className="px-4 py-3">Distance to Center</th>
                <th className="px-4 py-3 rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center text-white text-xs">A</div>
                  Amit Kumar
                </td>
                <td className="px-4 py-3.5 text-amber-400 font-bold">4.4 ★</td>
                <td className="px-4 py-3.5 text-green-400 font-bold">ENABLED</td>
                <td className="px-4 py-3.5">5 KM</td>
                <td className="px-4 py-3.5 text-purple-300">~1.2 KM</td>
                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">ONLINE</span></td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center text-white text-xs">R</div>
                  Ravi Sharma
                </td>
                <td className="px-4 py-3.5 text-amber-400 font-bold">4.9 ★</td>
                <td className="px-4 py-3.5 text-green-400 font-bold">ENABLED</td>
                <td className="px-4 py-3.5">5 KM</td>
                <td className="px-4 py-3.5 text-purple-300">~2.7 KM</td>
                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">ONLINE</span></td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center text-white text-xs">S</div>
                  Suresh Panda
                </td>
                <td className="px-4 py-3.5 text-amber-400 font-bold">4.7 ★</td>
                <td className="px-4 py-3.5 text-green-400 font-bold">ENABLED</td>
                <td className="px-4 py-3.5">5 KM</td>
                <td className="px-4 py-3.5 text-purple-300">~4.3 KM</td>
                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/30">ONLINE</span></td>
              </tr>
              <tr className="hover:bg-white/5 transition-colors">
                <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center text-white text-xs">D</div>
                  Deepak Nayak
                </td>
                <td className="px-4 py-3.5 text-amber-400 font-bold">5.0 ★</td>
                <td className="px-4 py-3.5 text-red-400 font-bold">DISABLED</td>
                <td className="px-4 py-3.5">5 KM</td>
                <td className="px-4 py-3.5 text-gray-400">~7.5 KM (Outside)</td>
                <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30">OFFLINE</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Engine Rules Panel */}
      <div className="glass-card p-6 rounded-3xl border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold font-outfit text-white">Scoring & Ranking Engine Weights</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Distance</span>
            <span className="text-base font-bold font-outfit text-purple-400">40%</span>
          </div>
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Availability</span>
            <span className="text-base font-bold font-outfit text-purple-400">20%</span>
          </div>
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Rating</span>
            <span className="text-base font-bold font-outfit text-purple-400">15%</span>
          </div>
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Acceptance Rate</span>
            <span className="text-base font-bold font-outfit text-purple-400">10%</span>
          </div>
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Completion Rate</span>
            <span className="text-base font-bold font-outfit text-purple-400">10%</span>
          </div>
          <div className="bg-obsidian-800 p-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] text-gray-400 block">Workload</span>
            <span className="text-base font-bold font-outfit text-purple-400">5%</span>
          </div>
        </div>
      </div>

    </div>
  );
};
