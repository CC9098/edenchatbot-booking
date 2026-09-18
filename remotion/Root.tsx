import { Composition } from 'remotion';
import { BookingIntroVideo } from './scenes/BookingIntroVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BookingSystemIntroZH"
        component={BookingIntroVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
