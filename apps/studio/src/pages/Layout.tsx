import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import "overlayscrollbars/overlayscrollbars.css";
import { useOverlayScrollbars } from "overlayscrollbars-react";

export default function Layout() {
  const [initBodyScrollbars] = useOverlayScrollbars({
    options: {
      scrollbars: {
        theme: "os-theme-dark",
        autoHide: "never",
        clickScroll: true,
      },
    },
  });

  useEffect(() => {
    initBodyScrollbars(document.body);
  }, [initBodyScrollbars]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const currentTab =
    location.pathname === "/playground" ? "/playground" : "/projects";

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 h-14 bg-transparent z-50">
        <span></span>

        <div className="flex items-center gap-3">
          <Tabs value={currentTab} onValueChange={(v) => navigate(v)}>
            <TabsList>
              <TabsTrigger value="/playground">奇想园</TabsTrigger>
              <TabsTrigger value="/projects">大事记</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {user && (
              <Avatar>
                <AvatarImage src={user.avatar ?? undefined} alt={user.username} />
                <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <Button variant="ghost" size="sm" onClick={() => void logout()} className="h-8 px-2 text-xs">
              登出
            </Button>
          </div>
        </div>
      </nav>

      <div key={location.pathname} className="animate-fade-in">
        <Outlet />
      </div>
    </>
  );
}
