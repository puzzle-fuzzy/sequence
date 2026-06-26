import { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
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

          <AvatarGroup className="grayscale">
            <Avatar>
              <AvatarImage
                src="https://github.com/maxleiter.png"
                alt="@maxleiter"
              />
              <AvatarFallback>LR</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarImage
                src="https://github.com/evilrabbit.png"
                alt="@evilrabbit"
              />
              <AvatarFallback>ER</AvatarFallback>
            </Avatar>
            <AvatarGroupCount>+3</AvatarGroupCount>
          </AvatarGroup>
        </div>
      </nav>

      <div key={location.pathname} className="animate-fade-in">
        <Outlet />
      </div>
    </>
  );
}
