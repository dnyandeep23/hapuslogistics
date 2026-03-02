import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getMe } from "@/services/user";
import { logoutUser as logoutUserService } from "@/services/auth";
import { User } from "@/types";

const getRejectReason = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || "UNKNOWN_ERROR";
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "UNKNOWN_ERROR";
};

type FetchUserReject = {
  reason: string;
};

export interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  reason: string | null;
}


const initialState: UserState = {
  user: null,
  loading: false,
  error: null,
  reason: null,
};

/* ---------------- ASYNC THUNK ---------------- */

export const fetchUser = createAsyncThunk<
  User,                    // fulfilled return type
  void,                    // thunk argument
  { rejectValue: FetchUserReject }
>(
  "user/fetchUser",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getMe();
      return response.user;
    } catch (err: unknown) {
      return rejectWithValue({
        reason: getRejectReason(err),
      });
    }
  }
);

export const logoutUser = createAsyncThunk(
  "user/logoutUser",
  async () => {
    await logoutUserService();
  }
);


export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearUser(state) {
      state.user = null;
      state.error = null;
      state.reason = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.reason = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.loading = false;
        state.error = "Something went wrong while loading your profile. Please try again.";
        state.reason = action.payload?.reason || "UNKNOWN_ERROR";
      })
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.error = null;
        state.reason = "LOGGED_OUT";
      })
      .addCase(logoutUser.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.reason = "LOGGED_OUT";
      });
  },
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
