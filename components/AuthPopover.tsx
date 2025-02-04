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
import Image from "next/image";
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User } from '@supabase/supabase-js';
import { UserCircle, Settings, History, LogOut } from 'lucide-react';
import OneTapComponent from './OneTapComponent';

const AuthPopover = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
console.log(user)
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleAuth = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }

      // Try to sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        router.refresh();
        return;
      }

      // If sign in fails, try to sign up
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

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="border-0 sm:border p-2">
            {user ? (
              <UserCircle className="h-6 w-6" />
            ) : (
              <Image
                className="dark:invert"
                src="/login.png"
                alt="loginsignupimage"
                width={24}
                height={24}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 mr-8 sm:mr-20">
          {user ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-3 pb-3 border-b">
                <UserCircle className="h-10 w-10" />
                <div className="flex flex-col">
                  <span className="font-medium">{user.email}</span>
                  <span className="text-sm text-gray-500">Account Settings</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <History className="h-4 w-4" />
                  Activity History
                </Button>
              </div>
              
              <div className="pt-2 border-t">
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
                className="w-full bg-black text-white font-bold"
                onClick={handleAuth}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Login | Sign up'}
              </Button>
{/*               
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div> */}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {/* {!user && <OneTapComponent />} */}
    </>
  );
};

export default AuthPopover;