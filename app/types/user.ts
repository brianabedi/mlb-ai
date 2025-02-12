// app/types/user.ts
export interface User {
    id: string;
    email?: string | undefined;
  }
  
  export interface Report {
    title: string;
    content: string;
    image_url?: string | null;
  }