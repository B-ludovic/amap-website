'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useModal } from "../../../contexts/ModalContext";
import { Search, UserCog, Trash2, Shield, User, Crown } from "lucide-react";