// app/components/AuthPopover.tsx
"use client"
import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User } from '@supabase/supabase-js';
import { UserCircle, Settings, History, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

const supabase = createClient();

const AuthPopover = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        if (mounted) {
          setUser(session?.user ?? null);
          setIsInitialized(true);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mounted) {
          setUser(null);
          setIsInitialized(true);
        }
      }
    };

    initialize();
  }, []);

  const handleAuth = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        router.refresh();
        return;
      }

      if (signInError.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        setError('Please check your email to confirm your account');
      } else {
        setError(signInError.message);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="border-0 sm:border p-2">
          {user ? (
            <UserCircle className="h-6 w-6" />
          ) : (
            <p className="text-xs font-semibold">Login</p>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 mr-8 sm:mr-20">
        {user ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <UserCircle className="h-6 w-6" />
              <div className="flex flex-col">
                <span className="font-medium">{user.email}</span>
                {/* <span className="text-sm text-gray-500">Account Settings</span> */}
              </div>
            </div>
            
            {/* <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <History className="h-4 w-4" />
                Activity History
              </Button>
            </div> */}
            
            <div className="pt-2  ">
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-2 text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@gmail.com"
                  className="col-span-2 h-8"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  className="col-span-2 h-8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className=" m-auto bg-black text-white font-bold "
              onClick={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Login | Sign up'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default AuthPopover;